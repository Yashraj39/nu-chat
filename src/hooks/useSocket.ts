import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";

const WS =
    import.meta.env.VITE_WS_URL ||
    (import.meta.env.PROD
        ? "wss://nu-chat.onrender.com/ws"
        : "ws://localhost:8080/ws");

function isJwtExpired(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return true;

        const payload = JSON.parse(
            atob(
                parts[1]
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
                    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=")
            )
        );

        return typeof payload.exp !== "number" ||
            payload.exp * 1000 <= Date.now();
    } catch {
        return true;
    }
}

function expireSession() {
    sessionStorage.removeItem("pulse_token");
    sessionStorage.removeItem("pulse_user");
    // Also clean up keys left behind by older releases.
    localStorage.removeItem("pulse_token");
    localStorage.removeItem("pulse_user");
    window.dispatchEvent(new Event("pulse:session-expired"));
}

export function useSocket(
    onChat: (x: any) => void,
    onGames: (x: any) => void,
    onGameState: (x: any) => void,
    roomId?: string
) {
    const [connected, setConnected] = useState(false);

    const clientRef = useRef<Client | null>(null);
    const subscriptionsRef = useRef<StompSubscription[]>([]);

    const onChatRef = useRef(onChat);
    const onGamesRef = useRef(onGames);
    const onGameStateRef = useRef(onGameState);

    useEffect(() => {
        onChatRef.current = onChat;
    }, [onChat]);

    useEffect(() => {
        onGamesRef.current = onGames;
    }, [onGames]);

    useEffect(() => {
        onGameStateRef.current = onGameState;
    }, [onGameState]);

    useEffect(() => {
        // Authentication is stored in sessionStorage. Keeping the WebSocket
        // on the same storage source as the REST client prevents a perpetual
        // "Reconnecting…" state after the auth-storage migration.
        const token = sessionStorage.getItem("pulse_token");

        if (!token) {
            setConnected(false);
            return;
        }

        // Do not even open a WebSocket with an already-expired JWT.
        if (isJwtExpired(token)) {
            expireSession();
            setConnected(false);
            return;
        }

        const client = new Client({
            brokerURL: WS,

            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },

            reconnectDelay: 1500,

            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,

            debug: (message) => {
                console.log("[STOMP]", message);
            },
        });

        client.onConnect = () => {
            setConnected(true);

            subscriptionsRef.current.forEach((subscription) => {
                try {
                    subscription.unsubscribe();
                } catch {
                    // Ignore already removed subscriptions.
                }
            });

            subscriptionsRef.current = [];

            subscriptionsRef.current.push(
                client.subscribe(
                    "/topic/chat",
                    (message: IMessage) => {
                        try {
                            onChatRef.current(JSON.parse(message.body));
                        } catch (error) {
                            console.error(
                                "Invalid chat WebSocket message:",
                                error
                            );
                        }
                    }
                )
            );

            subscriptionsRef.current.push(
                client.subscribe(
                    "/topic/games",
                    (message: IMessage) => {
                        try {
                            onGamesRef.current(JSON.parse(message.body));
                        } catch (error) {
                            console.error(
                                "Invalid game WebSocket message:",
                                error
                            );
                        }
                    }
                )
            );

            subscriptionsRef.current.push(
                client.subscribe(
                    "/topic/game/rooms/remove",
                    (message: IMessage) => {
                        try {
                            const data = JSON.parse(message.body);
                            onGamesRef.current({
                                type: "ROOM_REMOVED",
                                roomId: String(data),
                            });
                        } catch (error) {
                            console.error(
                                "Invalid room-removal WebSocket message:",
                                error
                            );
                        }
                    }
                )
            );

            if (roomId) {
                subscriptionsRef.current.push(
                    client.subscribe(
                        `/topic/game/${roomId}`,
                        (message: IMessage) => {
                            try {
                                onGamesRef.current(JSON.parse(message.body));
                            } catch (error) {
                                console.error(
                                    "Invalid room WebSocket message:",
                                    error
                                );
                            }
                        }
                    )
                );

                subscriptionsRef.current.push(
                    client.subscribe(
                        `/topic/game/${roomId}/state`,
                        (message: IMessage) => {
                            try {
                                onGameStateRef.current(JSON.parse(message.body));
                            } catch (error) {
                                console.error(
                                    "Invalid game-state WebSocket message:",
                                    error
                                );
                            }
                        }
                    )
                );
            }
        };

        client.onDisconnect = () => {
            setConnected(false);
        };

        client.onWebSocketClose = (event) => {
            console.log("WebSocket closed:", event);
            setConnected(false);
        };

        client.onWebSocketError = (error) => {
            console.error("WebSocket error:", error);
            setConnected(false);
        };

        client.onStompError = (frame) => {
            console.error(
                "STOMP error:",
                frame.headers["message"],
                frame.body
            );

            setConnected(false);

            // Only treat an explicit authentication error as a dead session.
            const text = `${frame.headers["message"] || ""} ${frame.body || ""}`.toLowerCase();
            if (
                (text.includes("invalid") && text.includes("token")) ||
                (text.includes("expired") && text.includes("token")) ||
                text.includes("missing websocket token") ||
                text.includes("authentication required") ||
                text.includes("session is no longer valid")
            ) {
                expireSession();
            }
        };

        client.activate();
        clientRef.current = client;

        return () => {
            setConnected(false);

            subscriptionsRef.current.forEach((subscription) => {
                try {
                    subscription.unsubscribe();
                } catch {
                    // Ignore cleanup errors.
                }
            });

            subscriptionsRef.current = [];

            try {
                client.deactivate();
            } catch {
                // Ignore cleanup errors.
            }

            clientRef.current = null;
        };
    }, [roomId]);

    function send(destination: string, body: any) {
        const client = clientRef.current;

        if (!client) {
            console.warn(
                "Cannot send WebSocket message: client does not exist."
            );
            return;
        }

        if (!client.connected) {
            console.warn(
                "Cannot send WebSocket message: socket is not connected."
            );
            return;
        }

        client.publish({
            destination,
            body: JSON.stringify(body),
        });
    }

    return {
        connected,
        send,
    };
}

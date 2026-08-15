import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";

const WS =
    import.meta.env.VITE_WS_URL ||
    "ws://localhost:8080/ws";

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
        const token = localStorage.getItem("pulse_token");

        if (!token) {
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

            debug: () => {
                // Uncomment while debugging WebSocket:
                // console.log(message);
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

            /*
             * Chat updates
             */
            subscriptionsRef.current.push(
                client.subscribe(
                    "/topic/chat",
                    (message: IMessage) => {
                        try {
                            const data = JSON.parse(message.body);
                            onChatRef.current(data);
                        } catch (error) {
                            console.error(
                                "Invalid chat WebSocket message:",
                                error
                            );
                        }
                    }
                )
            );

            /*
             * Game room list updates
             */
            subscriptionsRef.current.push(
                client.subscribe(
                    "/topic/games",
                    (message: IMessage) => {
                        try {
                            const data = JSON.parse(message.body);
                            onGamesRef.current(data);
                        } catch (error) {
                            console.error(
                                "Invalid game WebSocket message:",
                                error
                            );
                        }
                    }
                )
            );

            /*
             * Individual game room updates
             */
            if (roomId) {
                subscriptionsRef.current.push(
                    client.subscribe(
                        `/topic/game/${roomId}`,
                        (message: IMessage) => {
                            try {
                                const data = JSON.parse(message.body);
                                onGamesRef.current(data);
                            } catch (error) {
                                console.error(
                                    "Invalid room WebSocket message:",
                                    error
                                );
                            }
                        }
                    )
                );

                /*
                 * Game state updates.
                 *
                 * This is especially important for Snake because
                 * the server should continuously publish the updated
                 * Snake position here.
                 */
                subscriptionsRef.current.push(
                    client.subscribe(
                        `/topic/game/${roomId}/state`,
                        (message: IMessage) => {
                            try {
                                const data = JSON.parse(message.body);

                                onGameStateRef.current(data);
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

        client.onWebSocketClose = () => {
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
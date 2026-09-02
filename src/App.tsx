import {
    Routes,
    Route,
    Navigate,
    Link,
    useLocation,
} from "react-router-dom";

import {
    useState,
    useEffect,
} from "react";

import {
    Moon,
    Sun,
    LogOut,
    MessageCircle,
    Gamepad2,
    ShieldCheck,
} from "lucide-react";

import { useSocket } from "./hooks/useSocket";
import type { Message } from "./types";

import {
    join,
    logout,
    heartbeat,
} from "./api";

import {
    useTheme,
} from "./hooks/useTheme";

import {
    ChatPage,
} from "./pages/ChatPage";

import {
    GamesPage,
} from "./pages/GamesPage";

import {
    GameRoomPage,
} from "./pages/GameRoomPage";

import {
    AdminPage,
} from "./pages/AdminPage";

export function App() {
    const [user, setUser] = useState<any>(() => {
        try {
            const token = localStorage.getItem("pulse_token");
            const storedUser = localStorage.getItem("pulse_user");

            if (!token || !storedUser) {
                return null;
            }

            return JSON.parse(storedUser);
        } catch {
            return null;
        }
    });

    const [dark, setDark] = useTheme();

    useEffect(() => {
        function handleSessionExpired() {
            void logout().finally(() => setUser(null));
        }

        window.addEventListener("pulse:session-expired", handleSessionExpired);

        return () => {
            window.removeEventListener("pulse:session-expired", handleSessionExpired);
        };
    }, []);

    // Keep the active display-name lease alive while the app is open.
    // The backend expires a lease automatically when these heartbeats stop.
    useEffect(() => {
        if (!user) return;

        let stopped = false;

        async function beat() {
            try {
                await heartbeat();
            } catch (error: any) {
                if (stopped) return;
                if (error?.response?.status === 401 || error?.response?.status === 409) {
                    void logout().finally(() => setUser(null));
                }
            }
        }

        void beat();
        const timer = window.setInterval(() => void beat(), 30_000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [user]);

    if (!user) {
        return <JoinPage onJoined={setUser} />;
    }

    return (
        <Shell
            user={user}
            dark={dark}
            setDark={setDark}
            onLogout={async () => {
                await logout();
                setUser(null);
            }}
        />
    );
}

function JoinPage({
    onJoined,
}: {
    onJoined: (user: any) => void;
}) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        function handleNameTaken() {
            setError("That name is already in use. Please choose another name.");
        }

        window.addEventListener("pulse:name-taken", handleNameTaken);
        return () => window.removeEventListener("pulse:name-taken", handleNameTaken);
    }, []);

    async function go(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError("");

        try {
            const joinedUser = await join(name, code);
            onJoined(joinedUser);
        } catch (error: any) {
            setError(
                error?.response?.data?.message ||
                "Could not join chat."
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen grid place-items-center p-5 bg-slate-950">
            <form
                onSubmit={go}
                className="panel w-full max-w-md p-8 space-y-5"
            >
                <div>
                    <div className="logo">P</div>
                    <h1 className="text-3xl font-bold mt-4">
                        Welcome 👋
                    </h1>
                    <p className="muted mt-2">
                        Choose your name to join the group.
                    </p>
                </div>

                <input
                    className="input"
                    placeholder="Your display name"
                    maxLength={32}
                    minLength={1}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />

                <details>
                    <summary className="cursor-pointer muted text-sm">
                        Admin access
                    </summary>
                    <input
                        className="input mt-3"
                        placeholder="Admin invite code (optional)"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                    />
                </details>

                {error && <div className="error">{error}</div>}

                <button
                    className="btn-primary w-full"
                    disabled={busy || name.trim().length < 1}
                >
                    {busy ? "Joining…" : "Join Chat"}
                </button>
            </form>
        </main>
    );
}

function Shell({
    user,
    dark,
    setDark,
    onLogout,
}: {
    user: any;
    dark: boolean;
    setDark: (value: boolean) => void;
    onLogout: () => void | Promise<void>;
}) {
    const location = useLocation();

    const [unreadCount, setUnreadCount] = useState(0);
    const [incomingMessage, setIncomingMessage] =
        useState<Message | null>(null);

    const { connected } = useSocket(
        (message: Message) => {
            setIncomingMessage(message);

            if (message.senderId === user.id) {
                return;
            }

            const isActuallyLookingAtChat =
                document.visibilityState === "visible" &&
                document.hasFocus() &&
                location.pathname === "/chat";

            if (isActuallyLookingAtChat) {
                return;
            }

            setUnreadCount((current) => current + 1);

            if (
                "Notification" in window &&
                Notification.permission === "granted"
            ) {
                let body = "You received a new message.";

                if (message.type === "TEXT" && message.content) {
                    body = message.content;
                } else if (message.type === "IMAGE") {
                    body = "Sent an image.";
                } else if (message.type === "FILE") {
                    body = `Sent a file${message.file?.originalName
                        ? `: ${message.file.originalName}`
                        : "."}`;
                } else if (message.type === "GIF") {
                    body = "Sent a GIF.";
                } else if (message.type === "STICKER") {
                    body = "Sent a sticker.";
                }

                new Notification(
                    message.senderName || "New message",
                    {
                        body,
                        tag: "chit-chat-message",
                        icon: "/favicon.ico",
                    }
                );
            }
        },
        () => {},
        () => {}
    );

    useEffect(() => {
        if (location.pathname !== "/chat") return;
        if (!("Notification" in window)) return;

        if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
        }
    }, [location.pathname]);

    useEffect(() => {
        document.title =
            unreadCount > 0
                ? `(${unreadCount}) Chit Chat`
                : "Chit Chat";
    }, [unreadCount]);

    useEffect(() => {
        function clearUnreadIfChatIsActive() {
            const chatIsActive =
                location.pathname === "/chat" &&
                document.visibilityState === "visible" &&
                document.hasFocus();

            if (chatIsActive) {
                setUnreadCount(0);
            }
        }

        document.addEventListener("visibilitychange", clearUnreadIfChatIsActive);
        window.addEventListener("focus", clearUnreadIfChatIsActive);

        return () => {
            document.removeEventListener("visibilitychange", clearUnreadIfChatIsActive);
            window.removeEventListener("focus", clearUnreadIfChatIsActive);
        };
    }, [location.pathname]);

    useEffect(() => {
        if (
            location.pathname === "/chat" &&
            document.visibilityState === "visible" &&
            document.hasFocus()
        ) {
            setUnreadCount(0);
        }
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <header className="topbar">
                <Link to="/chat" className="flex items-center gap-3">
                    <div className="logo small">Chit</div>
                    <span className="font-bold">Chat</span>
                </Link>

                <nav>
                    <Link to="/chat" className="navlink">
                        <MessageCircle size={18} />
                        Chat
                        {unreadCount > 0 && (
                            <span className="ml-1 inline-flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </Link>

                    <Link to="/games" className="navlink">
                        <Gamepad2 size={18} />
                        Games
                    </Link>

                    {user.role === "ADMIN" && (
                        <Link to="/admin" className="navlink">
                            <ShieldCheck size={18} />
                            Admin
                        </Link>
                    )}
                </nav>

                <div className="flex items-center gap-2">
                    <button
                        className="iconbtn"
                        title="Toggle theme"
                        onClick={() => setDark(!dark)}
                    >
                        {dark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    <button
                        className="iconbtn"
                        title="Logout"
                        onClick={() => void onLogout()}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatPage user={user} incomingMessage={incomingMessage} connected={connected} />} />
                <Route path="/games" element={<GamesPage user={user} />} />
                <Route path="/games/:id" element={<GameRoomPage user={user} />} />
                <Route path="/admin" element={<AdminPage user={user} />} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
        </div>
    );
}

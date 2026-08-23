import {
    Routes,
    Route,
    Navigate,
    Link,
    useLocation,
} from "react-router-dom";

import {
    useState,
    useEffect
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

    const [user, setUser] =
        useState<any>(() => {

            try {

                return JSON.parse(
                    localStorage.getItem(
                        "pulse_user"
                    ) || "null"
                );

            } catch {

                return null;
            }
        });


    const [dark, setDark] =
        useTheme();


    if (!user) {

        return (
            <JoinPage
                onJoined={setUser}
            />
        );
    }


    return (
        <Shell
            user={user}
            dark={dark}
            setDark={setDark}
            onLogout={() => {

                logout();

                setUser(null);
            }}
        />
    );
}


/* ============================================================
   JOIN
   ============================================================ */

function JoinPage({
    onJoined,
}: {
    onJoined: (user: any) => void;
}) {

    const [name, setName] =
        useState("");

    const [code, setCode] =
        useState("");

    const [busy, setBusy] =
        useState(false);

    const [error, setError] =
        useState("");


    async function go(
        event: React.FormEvent
    ) {

        event.preventDefault();

        setBusy(true);

        setError("");


        try {

            const user =
                await join(
                    name,
                    code
                );

            onJoined(user);

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

                    <div className="logo">
                        P
                    </div>

                    <h1 className="text-3xl font-bold mt-4">
                        Welcome 👋
                    </h1>

                    <p className="muted mt-2">
                        Choose your name to
                        join the group.
                    </p>

                </div>


                <input
                    className="input"
                    placeholder="Your display name"
                    maxLength={32}
                    value={name}
                    onChange={(event) =>
                        setName(
                            event.target.value
                        )
                    }
                />


                <details>

                    <summary className="cursor-pointer muted text-sm">
                        Admin access
                    </summary>

                    <input
                        className="input mt-3"
                        placeholder="Admin invite code (optional)"
                        value={code}
                        onChange={(event) =>
                            setCode(
                                event.target.value
                            )
                        }
                    />

                </details>


                {error && (
                    <div className="error">
                        {error}
                    </div>
                )}


                <button
                    className="btn-primary w-full"
                    disabled={
                        busy ||
                        name.trim()
                            .length < 2
                    }
                >
                    {busy
                        ? "Joining…"
                        : "Join Chat"}
                </button>

            </form>

        </main>
    );
}


/* ============================================================
   SHELL
   ============================================================ */

function Shell({
    user,
    dark,
    setDark,
    onLogout,
}: {
    user: any;

    dark: boolean;

    setDark: (
        value: boolean
    ) => void;

    onLogout: () => void;
}) {

    const location =
        useLocation();


    /*
     * Number of messages received while the user
     * is not actively looking at Chat.
     */
    const [
        unreadCount,
        setUnreadCount,
    ] = useState(0);


    /*
     * Last incoming chat message.
     *
     * This is passed down to ChatPage.
     */
    const [
        incomingMessage,
        setIncomingMessage,
    ] = useState<Message | null>(null);


    /*
     * One global chat WebSocket for the whole
     * logged-in application.
     *
     * Previously ChatPage owned this socket.
     * Now Shell owns it so messages can be detected
     * even while the user is on Games/Admin or another
     * browser tab.
     */
    const {
        connected,
    } = useSocket(

        (message: Message) => {

            /*
             * Always send the message to ChatPage.
             */
            setIncomingMessage(message);


            /*
             * Ignore messages sent by ourselves.
             */
            if (
                message.senderId ===
                user.id
            ) {
                return;
            }


            /*
             * Determine whether the user is
             * actually looking at the chat.
             *
             * We require ALL of these:
             *
             * 1. Browser tab/page is visible
             * 2. Browser window has focus
             * 3. Current route is /chat
             */
            const isActuallyLookingAtChat =
                document.visibilityState ===
                    "visible"
                &&
                document.hasFocus()
                &&
                location.pathname ===
                    "/chat";


            /*
             * User is reading Chat.
             *
             * Therefore:
             * - NO notification
             * - NO unread count
             */
            if (
                isActuallyLookingAtChat
            ) {

                return;
            }


            /*
             * User has switched away from Chat.
             *
             * Increase unread count.
             */
            setUnreadCount(
                (current) =>
                    current + 1
            );


            /*
             * Show browser notification.
             *
             * This works only while this website is
             * running. If NU Chat is completely closed,
             * nothing happens.
             */
            if (
                "Notification" in window
                &&
                Notification.permission ===
                    "granted"
            ) {

                let body =
                    "You received a new message.";


                if (
                    message.type ===
                    "TEXT"
                    &&
                    message.content
                ) {

                    body =
                        message.content;

                } else if (
                    message.type ===
                    "IMAGE"
                ) {

                    body =
                        "Sent an image.";

                } else if (
                    message.type ===
                    "FILE"
                ) {

                    body =
                        `Sent a file${message.file?.originalName
                            ? `: ${message.file.originalName}`
                            : "."}`;

                }


                new Notification(
                    message.senderName ||
                    "New message",
                    {
                        body,

                        tag:
                            "chit-chat-message",

                        icon:
                            "/favicon.ico",
                    }
                );
            }
        },

        /*
         * Games callback.
         */
        () => {},

        /*
         * Game state callback.
         */
        () => {}
    );


    /*
     * Ask for browser notification permission
     * only after Chat is opened.
     */
    useEffect(() => {

        if (
            location.pathname !==
            "/chat"
        ) {
            return;
        }


        if (
            !("Notification" in window)
        ) {
            return;
        }


        if (
            Notification.permission ===
            "default"
        ) {

            Notification
                .requestPermission()
                .catch(() => {});
        }

    }, [location.pathname]);


    /*
     * Update browser tab title.
     */
    useEffect(() => {

        if (
            unreadCount > 0
        ) {

            document.title =
                `(${unreadCount}) Chit Chat`;

        } else {

            document.title =
                "Chit Chat";
        }

    }, [unreadCount]);


    /*
     * Reset unread count when:
     *
     * - user comes back to the browser tab
     * - user focuses the browser window
     * - user is on /chat
     */
    useEffect(() => {

        function clearUnreadIfChatIsActive() {

            const chatIsActive =
                location.pathname ===
                    "/chat"
                &&
                document.visibilityState ===
                    "visible"
                &&
                document.hasFocus();


            if (
                chatIsActive
            ) {

                setUnreadCount(0);
            }
        }


        function handleVisibilityChange() {

            clearUnreadIfChatIsActive();
        }


        function handleFocus() {

            clearUnreadIfChatIsActive();
        }


        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );


        window.addEventListener(
            "focus",
            handleFocus
        );


        return () => {

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );


            window.removeEventListener(
                "focus",
                handleFocus
            );
        };

    }, [location.pathname]);


    /*
     * When the user navigates directly back to /chat
     * while the browser is focused, clear unread.
     */
    useEffect(() => {

        if (
            location.pathname ===
                "/chat"
            &&
            document.visibilityState ===
                "visible"
            &&
            document.hasFocus()
        ) {

            setUnreadCount(0);
        }

    }, [location.pathname]);


    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

            <header className="topbar">

                <Link
                    to="/chat"
                    className="flex items-center gap-3"
                >

                    <div className="logo small">
                        Chit
                    </div>

                    <span className="font-bold">
                        Chat
                    </span>

                </Link>


                <nav>

                    <Link
                        to="/chat"
                        className="navlink"
                    >

                        <MessageCircle
                            size={18}
                        />

                        Chat

                        {unreadCount > 0 && (

                            <span
                                className="ml-1 inline-flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold"
                            >
                                {unreadCount > 99
                                    ? "99+"
                                    : unreadCount}
                            </span>

                        )}

                    </Link>


                    <Link
                        to="/games"
                        className="navlink"
                    >

                        <Gamepad2
                            size={18}
                        />

                        Games

                    </Link>


                    {user.role ===
                        "ADMIN" && (

                        <Link
                            to="/admin"
                            className="navlink"
                        >

                            <ShieldCheck
                                size={18}
                            />

                            Admin

                        </Link>

                    )}

                </nav>


                <div className="flex items-center gap-2">

                    <button
                        className="iconbtn"
                        title="Toggle theme"
                        onClick={() =>
                            setDark(!dark)
                        }
                    >

                        {dark ? (
                            <Sun size={18} />
                        ) : (
                            <Moon size={18} />
                        )}

                    </button>


                    <button
                        className="iconbtn"
                        title="Logout"
                        onClick={onLogout}
                    >

                        <LogOut
                            size={18}
                        />

                    </button>

                </div>

            </header>


            <Routes>

                <Route
                    path="/"
                    element={
                        <Navigate
                            to="/chat"
                            replace
                        />
                    }
                />


                <Route
                    path="/chat"
                    element={
                        <ChatPage
                            user={user}
                            incomingMessage={
                                incomingMessage
                            }
                            connected={
                                connected
                            }
                        />
                    }
                />


                <Route
                    path="/games"
                    element={
                        <GamesPage
                            user={user}
                        />
                    }
                />


                <Route
                    path="/games/:id"
                    element={
                        <GameRoomPage
                            user={user}
                        />
                    }
                />


                <Route
                    path="/admin"
                    element={
                        <AdminPage
                            user={user}
                        />
                    }
                />


                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/chat"
                            replace
                        />
                    }
                />

            </Routes>

        </div>
    );
}
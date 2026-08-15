import {
    Routes,
    Route,
    Navigate,
    Link,
} from "react-router-dom";

import {
    useState,
} from "react";

import {
    Moon,
    Sun,
    LogOut,
    MessageCircle,
    Gamepad2,
    ShieldCheck,
} from "lucide-react";

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

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

            <header className="topbar">

                <Link
                    to="/chat"
                    className="flex items-center gap-3"
                >

                    <div className="logo small">
                        P
                    </div>

                    <span className="font-bold">
                        PulseChat
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
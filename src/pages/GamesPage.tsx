import {
    Gamepad2,
    Users,
    Plus,
    Trophy,
    Zap,
} from "lucide-react";

import {
    useEffect,
    useState,
} from "react";

import {
    useNavigate,
} from "react-router-dom";

import {
    createRoom,
    gameRooms,
    joinRoom,
} from "../api";

import {
    GameRoom,
    GameType,
    User,
} from "../types";

import {
    useSocket,
} from "../hooks/useSocket";


export function GamesPage({
    user,
}: {
    user: User;
}) {

    const [rooms, setRooms] =
        useState<GameRoom[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [creating, setCreating] =
        useState<GameType | null>(null);

    const navigate =
        useNavigate();


    async function refresh() {

        try {

            const data =
                await gameRooms();

            setRooms(data);

        } catch (error) {

            console.error(
                "Unable to load game rooms:",
                error
            );

        } finally {

            setLoading(false);
        }
    }


    useEffect(() => {
        refresh();
    }, []);


    useSocket(
        () => {},

        (room: GameRoom) => {

            setRooms(
                (current) => {

                    const index =
                        current.findIndex(
                            (item) =>
                                item.id ===
                                room.id
                        );


                    /*
                     * If room disappeared
                     * from server, remove it.
                     */
                    if (
                        room.status ===
                        "FINISHED"
                    ) {
                        return current.filter(
                            (item) =>
                                item.id !==
                                room.id
                        );
                    }


                    /*
                     * New room.
                     */
                    if (index === -1) {
                        return [
                            room,
                            ...current,
                        ];
                    }


                    /*
                     * Existing room.
                     */
                    const next =
                        [...current];

                    next[index] =
                        room;

                    return next;
                }
            );
        },

        () => {}
    );


    async function create(
        type: GameType
    ) {

        try {

            setCreating(type);

            const room =
                await createRoom(type);

            navigate(
                `/games/${room.id}`
            );

        } catch (error: any) {

            alert(
                error?.response?.data?.message ||
                "Unable to create room."
            );

        } finally {

            setCreating(null);
        }
    }


    async function join(
        id: string
    ) {

        try {

            await joinRoom(id);

            navigate(
                `/games/${id}`
            );

        } catch (error: any) {

            alert(
                error?.response?.data?.message ||
                "Unable to join room."
            );
        }
    }


    return (
        <main className="page">

            <div className="max-w-6xl mx-auto">

                {/* HEADER */}

                <div className="flex items-end justify-between mb-7">

                    <div>

                        <div className="flex items-center gap-2 mb-2">

                            <span
                                className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    px-2.5
                                    py-1
                                    rounded-full
                                    text-xs
                                    font-bold
                                    bg-blue-100
                                    text-blue-700
                                "
                            >
                                <Zap
                                    size={12}
                                />

                                REAL-TIME
                            </span>

                        </div>

                        <h1 className="title">
                            Games
                        </h1>

                        <p className="muted mt-1">
                            Take a break and
                            play together.
                        </p>

                    </div>

                </div>


                {/* GAME CARDS */}

                <div className="grid md:grid-cols-3 gap-4">

                    <GameCard
                        icon="⭕"
                        title="Tic-Tac-Toe"
                        description="Classic 2-player game"
                        players="2 players"
                        onClick={() =>
                            create("OX")
                        }
                        loading={
                            creating === "OX"
                        }
                    />


                    <GameCard
                        icon="🐍"
                        title="Snake"
                        description="Real-time multiplayer snake"
                        players="2–4 players"
                        onClick={() =>
                            create("SNAKE")
                        }
                        loading={
                            creating === "SNAKE"
                        }
                    />


                    <GameCard
                        icon="🎲"
                        title="Ludo"
                        description="Classic board game"
                        players="2–4 players"
                        onClick={() =>
                            create("LUDO")
                        }
                        loading={
                            creating === "LUDO"
                        }
                    />

                </div>


                {/* ROOMS */}

                <div className="flex items-center gap-3 mt-10 mb-4">

                    <h2 className="sectiontitle !m-0">
                        Active rooms
                    </h2>

                    <span className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800">
                        {rooms.length}
                    </span>

                </div>


                {loading ? (

                    <div className="empty">
                        Loading game rooms...
                    </div>

                ) : rooms.length === 0 ? (

                    <div className="empty">

                        <div className="text-4xl mb-3">
                            🎮
                        </div>

                        <b>
                            No active game rooms
                        </b>

                        <p className="mt-1">
                            Create a room and
                            invite your friends.
                        </p>

                    </div>

                ) : (

                    <div className="space-y-3">

                        {rooms.map(
                            (room) => (

                                <div
                                    className="roomrow"
                                    key={room.id}
                                >

                                    <div className="flex items-center gap-3">

                                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 grid place-items-center">
                                            {room.gameType ===
                                            "SNAKE"
                                                ? "🐍"
                                                : room.gameType ===
                                                  "OX"
                                                ? "⭕"
                                                : "🎲"}
                                        </div>

                                        <div>

                                            <b>
                                                {room.gameType ===
                                                "SNAKE"
                                                    ? "Snake"
                                                    : room.gameType ===
                                                      "OX"
                                                    ? "Tic-Tac-Toe"
                                                    : "Ludo"}
                                            </b>

                                            <p className="muted text-sm">
                                                {room.status}
                                                {" · "}
                                                {
                                                    room.id.slice(
                                                        0,
                                                        8
                                                    )
                                                }
                                            </p>

                                        </div>

                                    </div>


                                    <div className="flex items-center gap-3">

                                        <span className="muted flex items-center gap-1">

                                            <Users
                                                size={16}
                                            />

                                            {
                                                room.players
                                                    .length
                                            }
                                            /4

                                        </span>


                                        <button
                                            className="btn-secondary"
                                            onClick={() =>
                                                join(
                                                    room.id
                                                )
                                            }
                                        >
                                            {room.status ===
                                            "PLAYING"
                                                ? "View"
                                                : "Join"}
                                        </button>

                                    </div>

                                </div>
                            )
                        )}

                    </div>
                )}

            </div>

        </main>
    );
}


/* ============================================================
   GAME CARD
   ============================================================ */

function GameCard({
    icon,
    title,
    description,
    players,
    onClick,
    loading,
}: {
    icon: string;

    title: string;

    description: string;

    players: string;

    onClick: () => void;

    loading: boolean;
}) {

    return (
        <div className="gamecard">

            <div className="gameicon text-2xl">
                {icon}
            </div>

            <h2>
                {title}
            </h2>

            <p className="muted mt-1">
                {description}
            </p>

            <div className="flex items-center gap-1 mt-3 text-xs text-slate-500">
                <Users size={13} />
                {players}
            </div>

            <button
                className="btn-primary mt-5 w-full"
                onClick={onClick}
                disabled={loading}
            >
                {loading ? (
                    <>
                        Creating...
                    </>
                ) : (
                    <>
                        <Plus
                            size={17}
                        />
                        Create room
                    </>
                )}
            </button>

        </div>
    );
}
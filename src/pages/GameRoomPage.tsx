import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    Dices,
    LogOut,
    Play,
    RotateCcw,
    Trophy,
    Wifi,
    WifiOff,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
    gameAction,
    gameState,
    joinRoom,
    leaveRoom,
} from "../api";

import {
    GameRoom,
    GameState,
    User,
    Point,
} from "../types";

import { useSocket } from "../hooks/useSocket";


/* ============================================================
   GAME ROOM PAGE
   ============================================================ */

export function GameRoomPage({
    user,
}: {
    user: User;
}) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    if (!id) {
        return (
            <main className="page game-page">
                <div className="game-error">
                    <div className="game-error-icon">
                        !
                    </div>

                    <h2>Invalid game room</h2>

                    <p>
                        No game room ID was provided.
                    </p>

                    <button
                        className="btn-primary"
                        onClick={() => navigate("/games")}
                    >
                        Back to Games
                    </button>
                </div>
            </main>
        );
    }

    return (
        <GameRoomContent
            user={user}
            id={id}
        />
    );
}


/* ============================================================
   GAME ROOM CONTENT
   ============================================================ */

function GameRoomContent({
    user,
    id,
}: {
    user: User;
    id: string;
}) {
    const navigate = useNavigate();

    const [room, setRoom] =
        useState<GameRoom | null>(null);

    const [state, setState] =
        useState<GameState | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [actionLoading, setActionLoading] =
        useState(false);


    /* ========================================================
       LOAD INITIAL ROOM + STATE
       ======================================================== */

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError("");

                const joinedRoom =
                    await joinRoom(id);

                if (!cancelled) {
                    setRoom(joinedRoom);
                }

                const initialState =
                    await gameState(id);

                if (!cancelled) {
                    setState(initialState);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load this game room."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [id]);


    /* ========================================================
       WEBSOCKET ROOM UPDATE
       ======================================================== */

    const handleRoomUpdate = useCallback(
        (data: any) => {
            if (
                data?.id === id ||
                data?.id === String(id)
            ) {
                setRoom(data);
            }
        },
        [id]
    );


    /* ========================================================
       WEBSOCKET GAME STATE UPDATE
       ======================================================== */

    const handleGameState = useCallback(
        (data: any) => {
            if (
                data?.roomId === id ||
                data?.roomId === String(id)
            ) {
                setState(data);
            }
        },
        [id]
    );


    /* ========================================================
       SOCKET
       ======================================================== */

    const { connected } = useSocket(
        () => { },
        handleRoomUpdate,
        handleGameState,
        id
    );


    /* ========================================================
       GAME ACTION
       ======================================================== */

    const action = useCallback(
        async (
            actionName: string,
            payload?: any
        ) => {
            if (actionLoading) {
                return;
            }

            try {
                setActionLoading(true);
                setError("");

                const updated =
                    await gameAction(
                        id,
                        actionName,
                        payload
                    );

                if (updated) {
                    setState(updated);
                }
            } catch (err: any) {
                setError(
                    err?.response?.data?.message ||
                    "Invalid action."
                );
            } finally {
                setActionLoading(false);
            }
        },
        [id, actionLoading]
    );


    /* ========================================================
       LEAVE ROOM
       ======================================================== */

    async function handleLeave() {
        try {
            await leaveRoom(id);
        } catch (err) {
            console.error(
                "Failed to leave game room:",
                err
            );
        } finally {
            navigate("/games");
        }
    }


    /* ========================================================
       LOADING
       ======================================================== */

    if (loading) {
        return (
            <main className="page game-page">
                <div className="game-loading">

                    <div className="loading-spinner" />

                    <h2>
                        Loading game...
                    </h2>

                    <p className="muted">
                        Connecting to the game server
                    </p>

                </div>
            </main>
        );
    }


    /* ========================================================
       ERROR
       ======================================================== */

    if (error && (!room || !state)) {
        return (
            <main className="page game-page">
                <div className="game-error">

                    <div className="game-error-icon">
                        !
                    </div>

                    <h2>
                        Unable to open game
                    </h2>

                    <p>
                        {error}
                    </p>

                    <button
                        className="btn-primary"
                        onClick={() =>
                            navigate("/games")
                        }
                    >
                        Back to Games
                    </button>

                </div>
            </main>
        );
    }


    if (!room || !state) {
        return null;
    }


    /* ========================================================
       MAIN GAME ROOM
       ======================================================== */

    return (
        <main className="page game-page">

            <div className="game-room-container">

                {/* =================================================
                    TOP HEADER
                   ================================================= */}

                <div className="game-room-header">

                    <button
                        className="game-back-button"
                        onClick={() =>
                            navigate("/games")
                        }
                    >
                        <ArrowLeft size={18} />

                        <span>
                            Games
                        </span>
                    </button>


                    <div className="game-live-status">

                        {connected ? (
                            <>
                                <span className="live-dot" />

                                <Wifi size={15} />

                                Live
                            </>
                        ) : (
                            <>
                                <span className="offline-dot" />

                                <WifiOff size={15} />

                                Reconnecting
                            </>
                        )}

                    </div>


                    <button
                        className="game-leave-button"
                        onClick={handleLeave}
                    >
                        <LogOut size={17} />

                        Leave
                    </button>

                </div>


                {/* =================================================
                    GAME INFORMATION
                   ================================================= */}

                <div className="game-info">

                    <div>

                        <div className="game-type-badge">

                            {getGameIcon(
                                room.gameType
                            )}

                            {getGameName(
                                room.gameType
                            )}

                        </div>


                        <h1>
                            {getGameTitle(
                                room.gameType
                            )}
                        </h1>


                        <div className="game-players">

                            {room.players.map(
                                (player) => (
                                    <div
                                        className="game-player"
                                        key={player.userId}
                                    >

                                        <span className="player-avatar">

                                            {player.name
                                                ?.charAt(0)
                                                ?.toUpperCase() ||
                                                "?"}

                                        </span>


                                        <span>
                                            {player.name}
                                        </span>


                                        {player.userId ===
                                            user.id && (
                                                <span className="you-badge">
                                                    YOU
                                                </span>
                                            )}

                                    </div>
                                )
                            )}

                        </div>

                    </div>


                    <div className="game-room-code">

                        <span>
                            ROOM
                        </span>

                        <b>
                            {room.id.slice(0, 8)}
                        </b>

                    </div>

                </div>


                {/* =================================================
                    INLINE ERROR
                   ================================================= */}

                {error && (
                    <div className="game-inline-error">

                        <span>
                            {error}
                        </span>

                        <button
                            onClick={() =>
                                setError("")
                            }
                        >
                            ×
                        </button>

                    </div>
                )}


                {/* =================================================
                    GAME
                   ================================================= */}

                <div className="gameboardpanel">

                    {room.gameType === "OX" && (
                        <Ox
                            state={state}
                            user={user}
                            room={room}
                            action={action}
                        />
                    )}


                    {room.gameType === "SNAKE" && (
                        <Snake
                            state={state}
                            user={user}
                            action={action}
                            connected={connected}
                            loading={actionLoading}
                        />
                    )}


                    {room.gameType === "LUDO" && (
                        <Ludo
                            state={state}
                            room={room}
                            user={user}
                            action={action}
                            connected={connected}
                            loading={actionLoading}
                        />
                    )}

                </div>

            </div>

        </main>
    );
}


/* ============================================================
   TIC TAC TOE
   ============================================================ */

function Ox({
    state,
    user,
    room,
    action,
}: {
    state: GameState;
    user: User;
    room: GameRoom;
    action: (
        action: string,
        payload?: any
    ) => void;
}) {

    const board =
        Array.isArray(state.state.board)
            ? state.state.board
            : Array(9).fill("");


    const me =
        room.players.find(
            (player) =>
                player.userId === user.id
        )?.symbol;


    const winner =
        state.state.winner;


    const turn =
        state.state.turn;


    return (
        <div className="gamecenter">

            <div className="game-status-card">

                <div className="game-status-icon">

                    {winner ? (
                        <Trophy size={20} />
                    ) : (
                        <span className="turn-dot" />
                    )}

                </div>


                <div>

                    <b>

                        {winner
                            ? winner === "DRAW"
                                ? "It's a draw!"
                                : `${winner} wins!`
                            : `Turn: ${turn || "Waiting..."}`}

                    </b>


                    <span>

                        You are{" "}

                        <strong>
                            {me || "spectator"}
                        </strong>

                    </span>

                </div>

            </div>


            <div className="oxgrid">

                {board.map(
                    (value, index) => (

                        <button
                            key={index}
                            className={`cell ${value
                                ? "cell-filled"
                                : ""
                                } ${value === "X"
                                    ? "cell-x"
                                    : "cell-o"
                                }`}
                            disabled={
                                Boolean(value) ||
                                Boolean(winner)
                            }
                            onClick={() =>
                                action(
                                    "move",
                                    index
                                )
                            }
                        >
                            {value}
                        </button>

                    )
                )}

            </div>

        </div>
    );
}


/* ============================================================
   SNAKE
   ============================================================ */

function Snake({
    state,
    user,
    action,
    connected,
    loading,
}: {
    state: GameState;
    user: User;
    action: (
        action: string,
        payload?: any
    ) => void;
    connected: boolean;
    loading: boolean;
}) {

    const boardSize = 20;


    const [started, setStarted] =
        useState(false);


    const [direction, setDirection] =
        useState<
            "UP" |
            "DOWN" |
            "LEFT" |
            "RIGHT"
        >("RIGHT");


    const keyboardDirection =
        useRef(direction);


    /* ========================================================
       EXTRACT ALL SNAKES
       ======================================================== */

    const snakes = useMemo<
        Record<string, Point[]>
    >(
        () =>
            extractSnakes(
                state.state
            ),
        [state]
    );


    /* ========================================================
       CURRENT PLAYER SNAKE
       ======================================================== */

    const snake =
    snakes[user.id] ||
    snakes["default"] ||
    [];


    /* ========================================================
       EXTRACT FOOD
       ======================================================== */

    const food = useMemo<Point | null>(
        () =>
            extractFood(
                state.state
            ),
        [state]
    );


    /* ========================================================
       GAME STARTED
       ======================================================== */

    const gameStarted =
        Boolean(
            state.state.started ??
            state.state.running ??
            started
        );


    /* ========================================================
       GAME OVER
       ======================================================== */

    const gameOver =
        Boolean(
            state.state.gameOver ??
            state.state.over
        );


    /* ========================================================
       SCORE
       ======================================================== */

    const score =
        Number(
            state.state.score ??
            (
                state.state.scores &&
                    typeof state.state.scores === "object"
                    ? state.state.scores[user.id]
                    : 0
            ) ??
            0
        );


    /* ========================================================
       KEYBOARD CONTROLS
       ======================================================== */

    useEffect(() => {

        function handleKeyDown(
            event: KeyboardEvent
        ) {

            const key =
                event.key.toLowerCase();


            let next:
                | "UP"
                | "DOWN"
                | "LEFT"
                | "RIGHT"
                | null = null;


            if (
                key === "arrowup" ||
                key === "w"
            ) {
                next = "UP";
            }


            if (
                key === "arrowdown" ||
                key === "s"
            ) {
                next = "DOWN";
            }


            if (
                key === "arrowleft" ||
                key === "a"
            ) {
                next = "LEFT";
            }


            if (
                key === "arrowright" ||
                key === "d"
            ) {
                next = "RIGHT";
            }


            if (!next) {
                return;
            }


            event.preventDefault();


            keyboardDirection.current =
                next;


            setDirection(next);


            action(
                "direction",
                next
            );
        }


        window.addEventListener(
            "keydown",
            handleKeyDown
        );


        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };

    }, [action]);


    /* ========================================================
       START GAME
       ======================================================== */

    async function startGame() {

        if (!connected) {
            return;
        }

        setStarted(true);

        await action("start");
    }


    /* ========================================================
       CHANGE DIRECTION
       ======================================================== */

    function changeDirection(
        next:
            | "UP"
            | "DOWN"
            | "LEFT"
            | "RIGHT"
    ) {

        keyboardDirection.current =
            next;

        setDirection(next);


        action(
            "direction",
            next
        );
    }


    return (
        <div className="snake-game">

            {/* =================================================
                TOP BAR
               ================================================= */}

            <div className="snake-topbar">

                <div className="snake-stat">

                    <span>
                        Score
                    </span>

                    <strong>
                        {score}
                    </strong>

                </div>


                <div className="snake-state">

                    <span
                        className={
                            connected
                                ? "snake-online"
                                : "snake-offline"
                        }
                    >

                        <span className="snake-status-dot" />

                        {connected
                            ? "LIVE"
                            : "OFFLINE"}

                    </span>

                </div>


                <div className="snake-stat">

                    <span>
                        Direction
                    </span>

                    <strong>
                        {direction}
                    </strong>

                </div>

            </div>


            {/* =================================================
                BOARD
               ================================================= */}

            <div className="snake-board-wrapper">

                <div
                    className={`snake-board ${gameOver
                        ? "snake-game-over"
                        : ""
                        }`}
                >

                    <div className="snake-grid" />


                    {/* FOOD */}

                    {food && (
                        <div
                            className="snake-food"
                            style={{
                                left: `${(
                                    food.x /
                                    boardSize
                                ) * 100
                                    }%`,

                                top: `${(
                                    food.y /
                                    boardSize
                                ) * 100
                                    }%`,
                            }}
                        >
                            <span />
                        </div>
                    )}


                    {/* ALL PLAYERS' SNAKES */}

                    {Object.entries(snakes).map(
                        ([playerId, playerSnake]) =>
                            playerSnake.map(
                                (
                                    segment,
                                    index
                                ) => (

                                    <div
                                        key={`${playerId}-${segment.x}-${segment.y}-${index}`}
                                        className={`snake-segment ${index === 0
                                            ? "snake-head"
                                            : "snake-body"
                                            }`}
                                        style={{
                                            left: `${(
                                                segment.x /
                                                boardSize
                                            ) * 100
                                                }%`,

                                            top: `${(
                                                segment.y /
                                                boardSize
                                            ) * 100
                                                }%`,
                                        }}
                                    >

                                        {index === 0 && (
                                            <>
                                                <span className="snake-eye eye-one" />

                                                <span className="snake-eye eye-two" />
                                            </>
                                        )}

                                    </div>

                                )
                            )
                    )}


                    {/* =================================================
                        START OVERLAY
                       ================================================= */}

                    {!gameStarted &&
                        snake.length === 0 && (

                            <div className="snake-overlay">

                                <div className="snake-overlay-icon">
                                    🐍
                                </div>


                                <h2>
                                    Ready to play?
                                </h2>


                                <p>
                                    Use your keyboard
                                    or controls to
                                    move the snake.
                                </p>


                                <button
                                    className="snake-start-button"
                                    disabled={
                                        loading ||
                                        !connected
                                    }
                                    onClick={
                                        startGame
                                    }
                                >

                                    <Play
                                        size={18}
                                        fill="currentColor"
                                    />


                                    {loading
                                        ? "Starting..."
                                        : "Start Game"}

                                </button>


                                {!connected && (
                                    <small>
                                        Waiting for
                                        server connection...
                                    </small>
                                )}

                            </div>
                        )}


                    {/* =================================================
                        GAME OVER
                       ================================================= */}

                    {gameOver && (

                        <div className="snake-overlay">

                            <div className="snake-overlay-icon">
                                💥
                            </div>


                            <h2>
                                Game Over
                            </h2>


                            <p>
                                Final score:{" "}

                                <strong>
                                    {score}
                                </strong>
                            </p>


                            <button
                                className="snake-start-button"
                                disabled={
                                    !connected
                                }
                                onClick={
                                    startGame
                                }
                            >

                                <RotateCcw size={18} />

                                Play Again

                            </button>

                        </div>
                    )}

                </div>

            </div>


            {/* =================================================
                MOBILE CONTROLS
               ================================================= */}

            <div className="snake-controls">

                <div className="snake-control-row">

                    <button
                        className="snake-control"
                        onClick={() =>
                            changeDirection(
                                "UP"
                            )
                        }
                    >
                        ↑
                    </button>

                </div>


                <div className="snake-control-row">

                    <button
                        className="snake-control"
                        onClick={() =>
                            changeDirection(
                                "LEFT"
                            )
                        }
                    >
                        ←
                    </button>


                    <button
                        className="snake-control snake-control-center"
                        onClick={
                            startGame
                        }
                    >
                        <Play size={17} />
                    </button>


                    <button
                        className="snake-control"
                        onClick={() =>
                            changeDirection(
                                "RIGHT"
                            )
                        }
                    >
                        →
                    </button>

                </div>


                <div className="snake-control-row">

                    <button
                        className="snake-control"
                        onClick={() =>
                            changeDirection(
                                "DOWN"
                            )
                        }
                    >
                        ↓
                    </button>

                </div>

            </div>


            <p className="snake-help">

                <span>
                    Keyboard:
                </span>{" "}

                Arrow keys or WASD

            </p>

        </div>
    );
}


/* ============================================================
   EXTRACT ALL SNAKES FROM SERVER STATE
   ============================================================ */

function extractSnakes(
    gameState: Record<string, unknown>
): Record<string, Point[]> {

    const result: Record<string, Point[]> = {};

    const snakes =
        gameState.snakes;


    /*
     * Backend format:
     *
     * snakes: {
     *     userId1: [...]
     *     userId2: [...]
     * }
     */

    if (
        snakes &&
        typeof snakes === "object" &&
        !Array.isArray(snakes)
    ) {

        const snakeObject =
            snakes as Record<string, unknown>;


        Object.entries(snakeObject).forEach(
            ([userId, value]) => {

                const body: unknown[] =
                    Array.isArray(value)
                        ? value
                        : (
                            value &&
                                typeof value === "object" &&
                                Array.isArray(
                                    (value as Record<string, unknown>).body
                                )
                                ? (
                                    (value as Record<string, unknown>)
                                        .body as unknown[]
                                )
                                : []
                        );


                result[userId] =
                    body
                        .map(
                            (point: unknown) =>
                                normalizePoint(point)
                        )
                        .filter(
                            (
                                point
                            ): point is Point =>
                                point !== null
                        );
            }
        );


        return result;
    }


    /*
     * Backend format:
     *
     * snakes: [
     *   {
     *      userId: "...",
     *      body: [...]
     *   }
     * ]
     */

    if (Array.isArray(snakes)) {

        snakes.forEach(
            (snake: unknown) => {

                if (
                    !snake ||
                    typeof snake !== "object"
                ) {
                    return;
                }


                const item =
                    snake as Record<
                        string,
                        unknown
                    >;


                const userId =
                    String(
                        item.userId ??
                        item.id ??
                        ""
                    );


                if (!userId) {
                    return;
                }


                const body =
                    Array.isArray(item.body)
                        ? item.body
                        : Array.isArray(item.snake)
                            ? item.snake
                            : [];


                result[userId] =
                    body
                        .map(
                            (point: unknown) =>
                                normalizePoint(point)
                        )
                        .filter(
                            (
                                point
                            ): point is Point =>
                                point !== null
                        );
            }
        );


        return result;
    }


    /*
     * If backend currently sends only one snake,
     * keep supporting that format.
     */

    const singleSnake =
        gameState.snake ??
        gameState.body;


    if (Array.isArray(singleSnake)) {

        result["default"] =
            singleSnake
                .map(
                    (point: unknown) =>
                        normalizePoint(point)
                )
                .filter(
                    (
                        point
                    ): point is Point =>
                        point !== null
                );
    }


    return result;
}


/* ============================================================
   EXTRACT FOOD
   ============================================================ */

function extractFood(
    gameState: Record<string, unknown>
): Point | null {

    const food =
        gameState.food ??
        gameState.apple;


    return normalizePoint(food);
}


/* ============================================================
   NORMALIZE POINT
   ============================================================ */

function normalizePoint(
    point: unknown
): Point | null {

    /*
     * Array format:
     *
     * [10, 15]
     */

    if (
        Array.isArray(point) &&
        point.length >= 2
    ) {

        const x =
            Number(point[0]);

        const y =
            Number(point[1]);


        if (
            Number.isFinite(x) &&
            Number.isFinite(y)
        ) {
            return {
                x,
                y,
            };
        }
    }


    /*
     * Object format:
     *
     * {
     *    x: 10,
     *    y: 15
     * }
     */

    if (
        point &&
        typeof point === "object"
    ) {

        const object =
            point as Record<
                string,
                unknown
            >;


        const x =
            Number(
                object.x ??
                object.col ??
                object.column
            );


        const y =
            Number(
                object.y ??
                object.row
            );


        if (
            Number.isFinite(x) &&
            Number.isFinite(y)
        ) {

            return {
                x,
                y,
            };
        }
    }


    return null;
}


/* ============================================================
   LUDO
   ============================================================ */

function Ludo({
    state,
    room,
    user,
    action,
    connected,
    loading,
}: {
    state: GameState;
    room: GameRoom;
    user: User;
    action: (
        action: string,
        payload?: any
    ) => void;
    connected: boolean;
    loading: boolean;
}) {

    const [rolling, setRolling] =
        useState(false);

    const passTriggered = useRef(false);

    const started =
        Boolean(state.state.started);

    const winnerId =
        state.state.winner
            ? String(state.state.winner)
            : null;

    const turnPlayerId =
        state.state.turnPlayerId
            ? String(state.state.turnPlayerId)
            : room.players[
                Number(state.state.turnIndex || 0)
            ]?.userId || null;

    const isMyTurn =
        started &&
        !winnerId &&
        turnPlayerId === user.id;

    const dice =
        Number(state.state.dice || 0);

    const pieces =
        state.state.pieces &&
            typeof state.state.pieces === "object"
            ? state.state.pieces as Record<string, number[]>
            : {};

    const myPieces =
        Array.isArray(pieces[user.id])
            ? pieces[user.id]
            : [-1, -1, -1, -1];

    const legalMoves =
        state.state.legalMoves &&
            typeof state.state.legalMoves === "object"
            ? state.state.legalMoves as Record<string, number[]>
            : {};

    const myLegalMoves =
        Array.isArray(legalMoves[user.id])
            ? legalMoves[user.id]
            : [];

    const playerById = useMemo(() => {
        const map: Record<string, GameRoom["players"][number]> = {};

        room.players.forEach((player) => {
            map[player.userId] = player;
        });

        return map;
    }, [room.players]);

    const COLOR_ORDER = [
        "red",
        "green",
        "yellow",
        "blue",
    ] as const;

    const colorByPlayerId = useMemo(() => {
        const map: Record<string, string> = {};

        room.players.forEach((player, index) => {
            map[player.userId] =
                COLOR_ORDER[index % COLOR_ORDER.length];
        });

        return map;
    }, [room.players]);

    const playerOrder =
        Array.isArray(state.state.playerOrder)
            ? state.state.playerOrder.map(String)
            : room.players.map((p) => p.userId);

    const turnPlayer =
        turnPlayerId
            ? playerById[turnPlayerId]
            : undefined;

    const winnerPlayer =
        winnerId
            ? playerById[winnerId]
            : undefined;

    /* ========================================================
       AUTO-PASS WHEN THE SERVER SAYS THERE IS NO LEGAL MOVE
       ======================================================== */

    useEffect(() => {
        const mustPass =
            isMyTurn &&
            dice > 0 &&
            myLegalMoves.length === 0;

        if (!mustPass) {
            passTriggered.current = false;
            return;
        }

        if (passTriggered.current) {
            return;
        }

        passTriggered.current = true;

        const timer = window.setTimeout(() => {
            action("pass");
        }, 2000);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        isMyTurn,
        dice,
        myLegalMoves.length,
        action,
    ]);

    async function rollDice() {
        if (
            !connected ||
            loading ||
            !isMyTurn ||
            dice !== 0
        ) {
            return;
        }

        setRolling(true);
        action("roll");

        window.setTimeout(() => {
            setRolling(false);
        }, 650);
    }

    function movePiece(pieceIndex: number) {
        if (
            loading ||
            !isMyTurn ||
            dice === 0 ||
            !myLegalMoves.includes(pieceIndex)
        ) {
            return;
        }

        action("move", pieceIndex);
    }

    function progressLabel(position: number) {
        if (position < 0) return "Yard";
        if (position === 57) return "Finished";
        if (position >= 52) return `Home ${position - 51}/6`;
        return `Track ${position + 1}/52`;
    }

    function boardPosition(
        playerIndex: number,
        progress: number,
        pieceIndex: number,
    ): { row: number; col: number } {

        if (progress < 0) {

            const homeSlots = [
                [1, 1],
                [1, 4],
                [4, 1],
                [4, 4],
            ];

            const [row, col] =
                homeSlots[pieceIndex % 4];

            const baseOffsets = [
                [0, 0],  // RED
                [0, 8],  // GREEN
                [8, 8],  // YELLOW
                [8, 0],  // BLUE
            ];

            return {
                row:
                    baseOffsets[playerIndex][0] +
                    row,

                col:
                    baseOffsets[playerIndex][1] +
                    col,
            };
        }

        /*
         * Final HOME position.
         */
        if (progress >= 57) {
            return {
                row: 7,
                col: 7,
            };
        }

        const mainPath = [
            [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
            [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
            [7, 14], [7, 13], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
            [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
            [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
            [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
            [7, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
            [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [1, 7],
        ];

        /*
         * Home lane.
         */
        if (progress >= 52) {

            const homePaths = [
                // RED -> BLUE finish lane
                [
                    [7, 2],
                    [7, 3],
                    [7, 4],
                    [7, 5],
                    [7, 6],
                ],

                // GREEN -> RED finish lane
                [
                    [2, 7],
                    [3, 7],
                    [4, 7],
                    [5, 7],
                    [6, 7],
                ],

                // YELLOW -> GREEN finish lane
                [
                    [7, 12],
                    [7, 11],
                    [7, 10],
                    [7, 9],
                    [7, 8],
                ],

                // BLUE -> YELLOW finish lane
                [
                    [12, 7],
                    [11, 7],
                    [10, 7],
                    [9, 7],
                    [8, 7],
                ],
            ];

            const homeIndex =
                Math.min(
                    progress - 52,
                    4
                );

            return {
                row:
                    homePaths[playerIndex][homeIndex][0],

                col:
                    homePaths[playerIndex][homeIndex][1],
            };
        }

        /*
         * IMPORTANT:
         *
         * No color shift here.
         *
         * RED    -> 0
         * GREEN  -> 13
         * YELLOW -> 26
         * BLUE   -> 39
         */
        const globalIndex =
            ((playerIndex - 1) * 13 + progress + 52) % 52;

        return {
            row: mainPath[globalIndex][0],
            col: mainPath[globalIndex][1],
        };
    }

    const pathCells = useMemo(() => {
        const mainPath = [
            [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
            [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
            [7, 14], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
            [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
            [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
            [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
            [7, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
            [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [1, 7],
        ];

        const set = new Map<string, number>();

        mainPath.forEach(([row, col], index) => {
            set.set(`${row}-${col}`, index);
        });

        return set;
    }, []);

    const homePathCells = useMemo(() => {
        const cells: Record<
            string,
            { color: string; progress: number }
        > = {};

        const paths = [
            // RED -> BLUE finish lane
            [
                [7, 2],
                [7, 3],
                [7, 4],
                [7, 5],
                [7, 6],
            ],

            // GREEN -> RED finish lane
            [
                [2, 7],
                [3, 7],
                [4, 7],
                [5, 7],
                [6, 7],
            ],

            // YELLOW -> GREEN finish lane
            [
                [7, 12],
                [7, 11],
                [7, 10],
                [7, 9],
                [7, 8],
            ],

            // BLUE -> YELLOW finish lane
            [
                [12, 7],
                [11, 7],
                [10, 7],
                [9, 7],
                [8, 7],
            ],
        ];

        paths.forEach((path, index) => {
            path.forEach(([row, col], step) => {
                cells[`${row}-${col}`] = {
                    color: ["red", "green", "yellow", "blue"][index],
                    progress: 52 + step,
                };
            });
        });

        return cells;
    }, []);

    const tokenEntries: Array<{
        playerId: string;
        playerIndex: number;
        pieceIndex: number;
        position: number;
    }> = [];

    playerOrder.forEach((playerId, playerIndex) => {
        const seatIndex =
            room.players.findIndex(
                (player) =>
                    player.userId === playerId
            );

        const actualSeat =
            seatIndex >= 0
                ? seatIndex
                : playerIndex;

        const playerPieces =
            Array.isArray(pieces[playerId])
                ? pieces[playerId]
                : [-1, -1, -1, -1];

        playerPieces.forEach((position, pieceIndex) => {
            tokenEntries.push({
                playerId,
                playerIndex: actualSeat,
                pieceIndex,
                position,
            });
        });
    });

    const stackedTokens: Record<string, typeof tokenEntries> = {};

    tokenEntries.forEach((token) => {
        const pos = boardPosition(
            token.playerIndex,
            token.position,
            token.pieceIndex,
        );

        const key = `${pos.row}-${pos.col}`;

        if (!stackedTokens[key]) {
            stackedTokens[key] = [];
        }

        stackedTokens[key].push(token);
    });

    return (
        <div className="ludo-game-shell">

            <div className="ludo-topbar">

                <div>
                    <span className="ludo-eyebrow">
                        LIVE MULTIPLAYER
                    </span>
                    <h2>
                        Ludo Arena
                    </h2>
                </div>

                <div className="ludo-turn-card">
                    <span>
                        {winnerPlayer
                            ? "Winner"
                            : started
                                ? "Current turn"
                                : "Game status"}
                    </span>

                    <strong>
                        {winnerPlayer?.name ||
                            turnPlayer?.name ||
                            (started
                                ? "Waiting..."
                                : "Waiting to start")}
                    </strong>
                </div>

                <div className="ludo-dice-panel">
                    <div
                        className={`ludo-die ${rolling ? "rolling" : ""}`}
                        aria-label={`Dice: ${dice || "not rolled"}`}
                    >
                        {dice || "—"}
                    </div>

                    <button
                        className="ludo-roll-button"
                        disabled={
                            !connected ||
                            loading ||
                            !isMyTurn ||
                            dice !== 0 ||
                            Boolean(winnerId)
                        }
                        onClick={rollDice}
                    >
                        <Dices size={18} />
                        Roll
                    </button>
                </div>
            </div>

            <div className="ludo-layout">

                <aside className="ludo-sidebar">
                    <div className="ludo-panel-card ludo-message-card">
                        <span className="ludo-panel-label">
                            GAME STATUS
                        </span>
                        <p>
                            {String(
                                state.state.message ||
                                "Choose your move."
                            )}
                        </p>
                    </div>

                    <div className="ludo-panel-card">
                        <div className="ludo-panel-header">
                            <span className="ludo-panel-label">
                                PLAYERS
                            </span>
                            <span className="ludo-player-count">
                                {room.players.length}/4
                            </span>
                        </div>

                        <div className="ludo-player-list">
                            {room.players.map((player, index) => {
                                const color =
                                    colorByPlayerId[player.userId];
                                const isTurn =
                                    player.userId === turnPlayerId;
                                const playerPieces =
                                    Array.isArray(pieces[player.userId])
                                        ? pieces[player.userId]
                                        : [-1, -1, -1, -1];
                                const finished = playerPieces.filter(
                                    (p) => p === 57
                                ).length;

                                return (
                                    <div
                                        className={`ludo-player-row ${isTurn
                                            ? "active"
                                            : ""
                                            }`}
                                        key={player.userId}
                                    >
                                        <span
                                            className={`ludo-color-dot ${color}`}
                                        />

                                        <div className="ludo-player-meta">
                                            <strong>
                                                {player.name}
                                                {player.userId === user.id
                                                    ? " (You)"
                                                    : ""}
                                            </strong>
                                            <span>
                                                {finished}/4 home
                                            </span>
                                        </div>

                                        {isTurn && (
                                            <span className="ludo-active-pill">
                                                TURN
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {started && !winnerId && (
                        <div className="ludo-panel-card">
                            <span className="ludo-panel-label">
                                YOUR TOKENS
                            </span>

                            <div className="ludo-token-summary">
                                {myPieces.map((position, index) => (
                                    <button
                                        key={index}
                                        className={`ludo-token-summary-item ${myLegalMoves.includes(index)
                                            ? "selectable"
                                            : ""
                                            }`}
                                        disabled={
                                            !myLegalMoves.includes(index)
                                        }
                                        onClick={() =>
                                            movePiece(index)
                                        }
                                    >
                                        <span>
                                            {index + 1}
                                        </span>
                                        <small>
                                            {progressLabel(position)}
                                        </small>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!started && !winnerId && (
                        <div className="ludo-panel-card ludo-start-card">
                            {room.hostId === user.id ? (
                                <>
                                    <span className="ludo-panel-label">
                                        READY
                                    </span>
                                    <p>
                                        {room.players.length < 2
                                            ? "Invite at least one more player to start."
                                            : "Everyone is ready. Start the match when you are ready."}
                                    </p>
                                    <button
                                        className="ludo-start-button"
                                        disabled={
                                            loading ||
                                            !connected ||
                                            room.players.length < 2
                                        }
                                        onClick={() =>
                                            action("start")
                                        }
                                    >
                                        <Play
                                            size={18}
                                            fill="currentColor"
                                        />
                                        Start Match
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="ludo-panel-label">
                                        WAITING FOR HOST
                                    </span>
                                    <p>
                                        {playerById[room.hostId]?.name || "Host"}
                                        {" "}will start the match when everyone is ready.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {winnerId && (
                        <div className="ludo-panel-card ludo-winner-card">
                            <Trophy size={22} />
                            <div>
                                <span>
                                    WINNER
                                </span>
                                <strong>
                                    {winnerPlayer?.name || "Player"}
                                </strong>
                            </div>
                        </div>
                    )}
                </aside>

                <div className="ludo-board-wrap">
                    <div className="ludo-board-shadow" />

                    <div className="ludo-board">

                        <div className="ludo-yard ludo-yard-red">
                            <div className="ludo-yard-inner">
                                <span>RED</span>
                                <div className="ludo-home-slots">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>
                            </div>
                        </div>

                        <div className="ludo-yard ludo-yard-green">
                            <div className="ludo-yard-inner">
                                <span>GREEN</span>
                                <div className="ludo-home-slots">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>
                            </div>
                        </div>

                        <div className="ludo-yard ludo-yard-yellow">
                            <div className="ludo-yard-inner">
                                <span>YELLOW</span>
                                <div className="ludo-home-slots">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>
                            </div>
                        </div>

                        <div className="ludo-yard ludo-yard-blue">
                            <div className="ludo-yard-inner">
                                <span>BLUE</span>
                                <div className="ludo-home-slots">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>
                            </div>
                        </div>

                        {[...Array(225)].map((_, index) => {
                            const row = Math.floor(index / 15);
                            const col = index % 15;
                            const key = `${row}-${col}`;
                            const pathIndex = pathCells.get(key);
                            const homeCell = homePathCells[key];

                            const safe =
                                pathIndex !== undefined &&
                                [0, 6, 13, 22, 27, 34, 39, 47].includes(pathIndex);

                            const isStart =
                                pathIndex !== undefined &&
                                [0, 13, 26, 39].includes(pathIndex);

                            return (
                                <div
                                    key={index}
                                    className={`ludo-cell ${pathIndex !== undefined
                                        ? "track"
                                        : ""
                                        } ${safe
                                            ? "safe"
                                            : ""
                                        } ${isStart
                                            ? "start"
                                            : ""
                                        } ${homeCell
                                            ? `home-lane ${homeCell.color}`
                                            : ""
                                        }`}
                                    style={{
                                        gridRow: row + 1,
                                        gridColumn: col + 1,
                                    }}
                                >
                                    {safe && (
                                        <span className="ludo-star">
                                            ★
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        <div className="ludo-finish-center">
                            <div className="ludo-finish-triangle red" />
                            <div className="ludo-finish-triangle green" />
                            <div className="ludo-finish-triangle yellow" />
                            <div className="ludo-finish-triangle blue" />
                            <span>
                                HOME
                            </span>
                        </div>

                        {Object.entries(stackedTokens).map(
                            ([cellKey, tokens]) => {
                                const [row, col] = cellKey
                                    .split("-")
                                    .map(Number);

                                return (
                                    <div
                                        className="ludo-token-stack"
                                        key={cellKey}
                                        style={{
                                            gridRow: row + 1,
                                            gridColumn: col + 1,
                                        }}
                                    >
                                        {tokens.map((token, stackIndex) => {
                                            const color =
                                                colorByPlayerId[token.playerId] ||
                                                "red";
                                            const selectable =
                                                token.playerId === user.id &&
                                                myLegalMoves.includes(token.pieceIndex);
                                            const recentlyMoved =
                                                state.state.lastMove &&
                                                String(state.state.lastMove.playerId) === token.playerId &&
                                                Number(state.state.lastMove.pieceIndex) === token.pieceIndex &&
                                                Number(state.state.lastMove.moveSequence) === Number(state.state.moveSequence);

                                            return (
                                                <button
                                                    key={`${token.playerId}-${token.pieceIndex}`}
                                                    className={`ludo-token ${color
                                                        } ${token.playerId === user.id
                                                            ? "mine"
                                                            : "opponent"
                                                        } ${selectable
                                                            ? "selectable"
                                                            : ""
                                                        } ${recentlyMoved
                                                            ? "recently-moved"
                                                            : ""
                                                        }`}
                                                    style={{
                                                        ["--stack-index" as string]: stackIndex,
                                                    } as React.CSSProperties}
                                                    disabled={!selectable}
                                                    onClick={() =>
                                                        movePiece(token.pieceIndex)
                                                    }
                                                    title={`${playerById[token.playerId]?.name || "Player"} · Token ${token.pieceIndex + 1}`}
                                                >
                                                    {token.pieceIndex + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            }
                        )}

                    </div>
                </div>
            </div>

            <div className="ludo-bottom-hint">
                <span>
                    Roll a 6 to bring a token out of your yard.
                </span>
                <span>
                    Safe cells cannot be captured • Exact roll required for HOME.
                </span>
            </div>
        </div>
    );
}

/* ============================================================
   GAME NAME
   ============================================================ */

function getGameName(
    type: string
) {

    switch (type) {

        case "OX":
            return "Tic-Tac-Toe";

        case "SNAKE":
            return "Snake";

        case "LUDO":
            return "Ludo";

        default:
            return "Game";
    }
}


/* ============================================================
   GAME TITLE
   ============================================================ */

function getGameTitle(
    type: string
) {

    switch (type) {

        case "OX":
            return "Tic-Tac-Toe";

        case "SNAKE":
            return "Multiplayer Snake";

        case "LUDO":
            return "Ludo";

        default:
            return "Game Room";
    }
}


/* ============================================================
   GAME ICON
   ============================================================ */

function getGameIcon(
    type: string
) {

    switch (type) {

        case "OX":
            return "✕";

        case "SNAKE":
            return "🐍";

        case "LUDO":
            return "🎲";

        default:
            return "🎮";
    }
}
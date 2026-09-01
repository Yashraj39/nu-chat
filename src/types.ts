export type Role =
    | "USER"
    | "ADMIN";

export type MessageType =
    | "TEXT"
    | "IMAGE"
    | "FILE";

export type ReplyReference = {
    messageId: string;
    senderId: string;
    senderName: string;
    type: MessageType;
    content?: string;
    fileName?: string;
    mimeType?: string;
    deleted: boolean;
};

export type Message = {
    id: string;
    senderId: string;
    senderName: string;
    type: MessageType;
    content?: string;
    file?: {
        url: string;
        publicId: string;
        originalName: string;
        mimeType: string;
        size: number;
    };
    replyTo?: ReplyReference | null;
    deleted: boolean;
    createdAt: string;
};

export type User = {
    id: string;
    displayName: string;
    role: Role;
};

export type GameType =
    | "OX"
    | "SNAKE"
    | "LUDO";

export type GameRoom = {
    id: string;
    gameType: GameType;
    status: string;
    hostId: string;
    players: {
        userId: string;
        name: string;
        symbol: string;
    }[];
};

export type Point = { x: number; y: number };
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type SnakeMap = Record<string, Point[]>;
export type NumberMap = Record<string, number>;
export type BooleanMap = Record<string, boolean>;
export type DirectionMap = Record<string, Direction>;

export type GameStateData = {
    board?: string[];
    turn?: string;
    winner?: string | null;
    snake?: Point[];
    snakes?: SnakeMap;
    food?: Point;
    direction?: Direction;
    nextDirection?: Direction;
    directions?: DirectionMap;
    running?: boolean;
    started?: boolean;
    startedPlayers?: BooleanMap;
    gameOver?: boolean;
    gameOvers?: BooleanMap;
    over?: boolean;
    score?: number;
    scores?: NumberMap;
    tick?: number;
    turnIndex?: number;
    turnPlayerId?: string | null;
    playerOrder?: string[];
    dice?: number;
    consecutiveSixes?: number;
    pieces?: Record<string, number[]>;
    legalMoves?: Record<string, number[]>;
    message?: string;
    moveSequence?: number;
    lastMove?: {
        moveSequence?: number;
        playerId?: string;
        pieceIndex?: number;
        from?: number;
        to?: number;
        captures?: string[];
    } | null;
    [key: string]: unknown;
};

export type GameState = {
    roomId: string;
    gameType: GameType;
    state: GameStateData;
    updatedAt?: string;
};

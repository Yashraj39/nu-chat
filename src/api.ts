import axios from "axios";


export const API =
    import.meta.env.VITE_API_BASE_URL ||
    "https://nu-chat.onrender.com";


export const client =
    axios.create({
        baseURL: API,

        timeout: 15000,

        headers: {
            Accept: "application/json",
        },
    });


/*
 * Attach JWT automatically.
 */
client.interceptors.request.use(
    (config) => {

        const token =
            localStorage.getItem(
                "pulse_token"
            );

        if (token) {
            config.headers.Authorization =
                `Bearer ${token}`;
        }

        return config;
    },

    (error) =>
        Promise.reject(error)
);


/*
 * Authentication
 */

export async function join(
    name: string,
    adminCode: string
) {

    const response =
        await client.post(
            "/api/auth/join",
            {
                name: name.trim(),
                adminCode:
                    adminCode.trim(),
            }
        );

    localStorage.setItem(
        "pulse_token",
        response.data.token
    );

    localStorage.setItem(
        "pulse_user",
        JSON.stringify(
            response.data.user
        )
    );

    return response.data.user;
}


export function logout() {

    localStorage.removeItem(
        "pulse_token"
    );

    localStorage.removeItem(
        "pulse_user"
    );
}


/*
 * Chat
 */

export async function messages() {

    const response =
        await client.get(
            "/api/messages"
        );

    return response.data;
}


export async function sendText(
    content: string
) {

    const response =
        await client.post(
            "/api/messages",
            {
                content:
                    content.trim(),
            }
        );

    return response.data;
}


export async function upload(
    file: File,
    onUploadProgress:
        (percent: number) => void
) {

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    const response =
        await client.post(
            "/api/files/upload",
            formData,
            {
                onUploadProgress: (
                    event
                ) => {

                    const percent =
                        Math.round(
                            (
                                event.loaded *
                                100
                            ) /
                            (
                                event.total ||
                                1
                            )
                        );

                    onUploadProgress(
                        percent
                    );
                },
            }
        );

    return response.data;
}


export async function sendFile(
    meta: any
) {

    const response =
        await client.post(
            "/api/messages/file",
            meta
        );

    return response.data;
}


export async function deleteMessage(
    id: string
) {

    const response =
        await client.delete(
            `/api/messages/${id}`
        );

    return response.data;
}


/*
 * Games
 */

export async function gameRooms() {

    const response =
        await client.get(
            "/api/games/rooms"
        );

    return response.data;
}


export async function createRoom(
    gameType: string
) {

    const response =
        await client.post(
            "/api/games/rooms",
            {
                gameType,
            }
        );

    return response.data;
}


export async function joinRoom(
    id: string
) {

    const response =
        await client.post(
            `/api/games/rooms/${id}/join`
        );

    return response.data;
}


export async function leaveRoom(
    id: string
) {

    const response =
        await client.post(
            `/api/games/rooms/${id}/leave`
        );

    return response.data;
}


export async function gameState(
    id: string
) {

    const response =
        await client.get(
            `/api/games/rooms/${id}/state`
        );

    return response.data;
}


export async function gameAction(
    id: string,
    action: string,
    payload?: any
) {

    const response =
        await client.post(
            `/api/games/rooms/${id}/action`,
            {
                action,
                payload,
            }
        );

    return response.data;
}
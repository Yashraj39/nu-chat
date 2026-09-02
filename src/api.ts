import axios from "axios";

export const API = import.meta.env.VITE_API_BASE_URL || "https://nu-chat.onrender.com";

export const client = axios.create({ baseURL: API, timeout: 30000, headers: { Accept: "application/json" } });
client.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("pulse_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
}, (error) => Promise.reject(error));
client.interceptors.response.use((response) => response, (error) => {
    if (error?.response?.status === 401) window.dispatchEvent(new Event("pulse:session-expired"));
    if (error?.response?.status === 409) window.dispatchEvent(new Event("pulse:name-taken"));
    return Promise.reject(error);
});

export async function join(name: string, adminCode: string) {
    const response = await client.post("/api/auth/join", { name: name.trim(), adminCode: adminCode.trim() });
    sessionStorage.setItem("pulse_token", response.data.token);
    sessionStorage.setItem("pulse_user", JSON.stringify(response.data.user));
    return response.data.user;
}

export async function heartbeat() {
    await client.post("/api/auth/heartbeat");
}

export async function logout() {
    try {
        if (sessionStorage.getItem("pulse_token")) {
            await client.post("/api/auth/logout");
        }
    } finally {
        sessionStorage.removeItem("pulse_token");
        sessionStorage.removeItem("pulse_user");
        localStorage.removeItem("pulse_token");
        localStorage.removeItem("pulse_user");
    }
}

export async function messages() { return (await client.get("/api/messages")).data; }
export async function sendText(content: string, replyToMessageId?: string) {
    return (await client.post("/api/messages", { content: content.trim(), ...(replyToMessageId ? { replyToMessageId } : {}) })).data;
}
export async function upload(file: File, onUploadProgress: (percent: number) => void) {
    const formData = new FormData(); formData.append("file", file);
    return (await client.post("/api/files/upload", formData, { onUploadProgress: e => onUploadProgress(Math.round((e.loaded * 100) / (e.total || 1))) })).data;
}
export async function sendFile(meta: any, replyToMessageId?: string) {
    return (await client.post("/api/messages/file", { ...meta, ...(replyToMessageId ? { replyToMessageId } : {}) })).data;
}
export async function sendMedia(media: { type: "GIF" | "STICKER"; provider: string; providerId?: string; title?: string; url: string; previewUrl?: string; width?: number; height?: number }, replyToMessageId?: string) {
    return (await client.post("/api/messages/file", { ...media, ...(replyToMessageId ? { replyToMessageId } : {}) })).data;
}
export async function sendMediaLink(media: { url: string; type?: "GIF" | "STICKER"; provider?: string; providerId?: string; title?: string }, replyToMessageId?: string) {
    return (await client.post("/api/media/link", { ...media, ...(replyToMessageId ? { replyToMessageId } : {}) })).data;
}
export async function savedMedia() {
    return (await client.get("/api/media/saved")).data;
}
export async function sendSavedMedia(id: string, replyToMessageId?: string) {
    return (await client.post(`/api/media/saved/${encodeURIComponent(id)}/send`, replyToMessageId ? { replyToMessageId } : {})).data;
}
export async function fileDownloadUrl(messageId: string) { return (await client.get(`/api/files/${encodeURIComponent(messageId)}/download-url`)).data.url as string; }
export async function deleteMessage(id: string) { return (await client.delete(`/api/messages/${id}`)).data; }
export async function gameRooms() { return (await client.get("/api/games/rooms")).data; }
export async function createRoom(gameType: string) { return (await client.post("/api/games/rooms", { gameType })).data; }
export async function joinRoom(id: string) { return (await client.post(`/api/games/rooms/${id}/join`)).data; }
export async function leaveRoom(id: string) { return (await client.post(`/api/games/rooms/${id}/leave`)).data; }
export async function gameState(id: string) { return (await client.get(`/api/games/rooms/${id}/state`)).data; }
export async function gameAction(id: string, action: string, payload?: any) { return (await client.post(`/api/games/rooms/${id}/action`, { action, payload })).data; }

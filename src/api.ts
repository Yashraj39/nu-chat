import axios from "axios";

export const API = import.meta.env.VITE_API_BASE_URL || "https://nu-chat.onrender.com";
export const FILE_STORAGE = (import.meta.env.VITE_FILE_STORAGE || "drive").trim().toLowerCase();

export const client = axios.create({
    baseURL: API,
    timeout: 30000,
    headers: { Accept: "application/json" }
});

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
    const response = await client.post("/api/auth/join", {
        name: name.trim(),
        adminCode: adminCode.trim()
    });
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

export async function messages() {
    return (await client.get("/api/messages")).data;
}

export async function sendText(content: string, replyToMessageId?: string) {
    return (await client.post("/api/messages", {
        content: content.trim(),
        ...(replyToMessageId ? { replyToMessageId } : {})
    })).data;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function createDriveUploadSession(file: File) {
    // Render supplies only a short-lived access token. The resumable session
    // itself is created from the browser, so Google associates it with the
    // same origin that performs the subsequent PUT upload.
    const bootstrap = await client.get("/api/files/drive/client-token");
    const accessToken = String(bootstrap.data?.accessToken || "").trim();
    const folderId = String(bootstrap.data?.folderId || "").trim();
    if (!accessToken) throw new Error("Google Drive access token was not provided.");
    if (!folderId) throw new Error("Google Drive folder is not configured.");

    const metadata = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        parents: [folderId]
    };

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": file.type || "application/octet-stream",
                "X-Upload-Content-Length": String(file.size)
            },
            body: JSON.stringify(metadata)
        }
    );

    if (!response.ok) {
        let detail = "";
        try {
            const body = await response.text();
            if (body) detail = `: ${body.slice(0, 240)}`;
        } catch {
            // Ignore an unreadable error body.
        }
        throw new Error(`Google Drive could not create the upload session (HTTP ${response.status})${detail}`);
    }

    const uploadUrl = response.headers.get("Location")?.trim() || "";
    if (!uploadUrl) throw new Error("Google Drive did not return an upload session.");
    return uploadUrl;
}

function uploadToDriveSession(uploadUrl: string, file: File, onUploadProgress: (percent: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.responseType = "text";
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onUploadProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
            }
        };
        xhr.onerror = () => reject(new Error("Google Drive upload could not reach the upload server."));
        xhr.ontimeout = () => reject(new Error("Google Drive upload timed out."));
        xhr.onabort = () => reject(new Error("Upload was cancelled."));
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
                } catch {
                    reject(new Error("Google Drive returned an invalid upload response."));
                }
            } else {
                reject(new Error(`Google Drive upload failed (HTTP ${xhr.status}).`));
            }
        };
        xhr.send(file);
    });
}

async function uploadToDrive(file: File, onUploadProgress: (percent: number) => void) {
    const uploadUrl = await createDriveUploadSession(file);
    const uploaded = await uploadToDriveSession(uploadUrl, file, onUploadProgress);
    const driveFileId = String(uploaded?.id || "").trim();
    if (!driveFileId) throw new Error("Google Drive did not return the uploaded file ID.");

    onUploadProgress(100);
    return (await client.post("/api/files/drive/complete", {
        fileId: driveFileId,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size
    })).data;
}

async function uploadToCloudinary(file: File, onUploadProgress: (percent: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    return (await client.post("/api/files/upload", formData, {
        onUploadProgress: e => onUploadProgress(Math.round((e.loaded * 100) / (e.total || 1)))
    })).data;
}

export async function upload(file: File, onUploadProgress: (percent: number) => void) {
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("File is too large. Maximum upload size is 25 MB.");
    }

    if (FILE_STORAGE === "cloudinary") {
        return uploadToCloudinary(file, onUploadProgress);
    }

    return uploadToDrive(file, onUploadProgress);
}

export async function sendFile(meta: any, replyToMessageId?: string) {
    return (await client.post("/api/messages/file", {
        ...meta,
        ...(replyToMessageId ? { replyToMessageId } : {})
    })).data;
}

export async function sendMedia(
    media: {
        type: "GIF" | "STICKER";
        provider: string;
        providerId?: string;
        title?: string;
        url: string;
        previewUrl?: string;
        width?: number;
        height?: number;
    },
    replyToMessageId?: string
) {
    return (await client.post("/api/messages/file", {
        ...media,
        ...(replyToMessageId ? { replyToMessageId } : {})
    })).data;
}

export async function savedMedia() {
    return (await client.get("/api/media/saved")).data;
}

export async function sendSavedMedia(id: string, replyToMessageId?: string) {
    return (await client.post(
        `/api/media/saved/${encodeURIComponent(id)}/send`,
        replyToMessageId ? { replyToMessageId } : {}
    )).data;
}

export function savedMediaContentUrl(id: string) {
    return `${API}/api/media/saved/content/${encodeURIComponent(id)}`;
}

export async function fileDownloadUrl(messageId: string) {
    return (await client.get(`/api/files/${encodeURIComponent(messageId)}/download-url`)).data.url as string;
}

export function fileContentUrl(publicId: string) {
    return `${API}/api/files/content?publicId=${encodeURIComponent(publicId)}`;
}

export async function deleteMessage(id: string) {
    return (await client.delete(`/api/messages/${id}`)).data;
}

export async function gameRooms() {
    return (await client.get("/api/games/rooms")).data;
}

export async function createRoom(gameType: string) {
    return (await client.post("/api/games/rooms", { gameType })).data;
}

export async function joinRoom(id: string) {
    return (await client.post(`/api/games/rooms/${id}/join`)).data;
}

export async function leaveRoom(id: string) {
    return (await client.post(`/api/games/rooms/${id}/leave`)).data;
}

export async function gameState(id: string) {
    return (await client.get(`/api/games/rooms/${id}/state`)).data;
}

export async function gameAction(id: string, action: string, payload?: any) {
    return (await client.post(`/api/games/rooms/${id}/action`, { action, payload })).data;
}

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Download, FileArchive, FileAudio, FileImage, FileText, FileVideo, Paperclip, Send, Trash2, Wifi, WifiOff } from "lucide-react";
import { deleteMessage, fileDownloadUrl, messages, sendFile, sendText, upload } from "../api";
import { Message, User } from "../types";

export function ChatPage({
    user,
    incomingMessage,
    connected,
}: {
    user: User;
    incomingMessage: Message | null;
    connected: boolean;
}) {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [nearBottom, setNearBottom] = useState(true);
    const end = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {

        if (
            !incomingMessage
        ) {
            return;
        }


        setMsgs(
            (current) => {

                /*
                 * Message already exists.
                 * Update it instead of duplicating it.
                 */
                if (
                    current.some(
                        (message) =>
                            message.id ===
                            incomingMessage.id
                    )
                ) {

                    return current.map(
                        (message) =>
                            message.id ===
                                incomingMessage.id
                                ? incomingMessage
                                : message
                    );
                }


                /*
                 * New message.
                 */
                return [
                    ...current,
                    incomingMessage,
                ].sort(
                    (a, b) =>
                        a.createdAt.localeCompare(
                            b.createdAt
                        )
                );
            }
        );

    }, [incomingMessage]);

    useEffect(() => {
        messages().then(setMsgs).catch(() => setError("Unable to load messages."));
    }, []);

    useEffect(() => {
        if (nearBottom) end.current?.scrollIntoView({ behavior: "smooth" });
    }, [msgs, nearBottom]);

    function scroll() {
        const e = list.current;
        if (!e) return;
        setNearBottom(e.scrollHeight - e.scrollTop - e.clientHeight < 100);
    }

    async function submit() {
        if (!text.trim() || !connected) return;
        try {
            await sendText(text);
            setText("");
        } catch (e: any) {
            setError(e.response?.data?.message || "Send failed.");
        }
    }

    async function attach(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;

        try {
            setError("");
            setProgress(0);
            const meta = await upload(f, setProgress);
            await sendFile(meta);
        } catch (e: any) {
            setError(e.response?.data?.message || "Upload failed.");
        } finally {
            setProgress(null);
        }
    }

    async function remove(id: string) {
        try {
            await deleteMessage(id);
        } catch (e: any) {
            setError(e.response?.data?.message || "Delete failed.");
        }
    }

    return <main className="page"><section className="chat-shell">
        <div className="chat-head">
            <div>
                <h1 className="font-bold text-lg">Campus Group</h1>
                <p className="muted text-xs">Everyone can chat here</p>
            </div>
            <div className={`status ${connected ? "online" : "offline"}`}>
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? "Connected" : "Reconnecting…"}
            </div>
        </div>

        <div ref={list} onScroll={scroll} className="message-list">
            {msgs.map(m => <MessageBubble
                key={m.id}
                m={m}
                own={m.senderId === user.id}
                canDelete={m.senderId === user.id || user.role === "ADMIN"}
                onDelete={remove}
            />)}
            <div ref={end} />
        </div>

        {!nearBottom && <button className="newmsg" onClick={() => {
            end.current?.scrollIntoView({ behavior: "smooth" });
            setNearBottom(true);
        }}><ArrowDown size={15} />New messages</button>}

        {error && <div className="px-4 pb-2"><div className="error">
            {error}<button onClick={() => setError("")}>×</button>
        </div></div>}

        {progress !== null && <div className="px-4 pb-2">
            <div className="uploadbar"><div style={{ width: `${progress}%` }} /></div>
            <span className="muted text-xs">Uploading… {progress}%</span>
        </div>}

        <div className="composer">
            <label className="iconbtn cursor-pointer" title="Attach any file">
                <Paperclip size={20} />
                <input hidden type="file" onChange={attach} />
            </label>
            <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                    }
                }}
                placeholder="Type a message…"
                rows={1}
            />
            <button className="btn-primary send" disabled={!connected || !text.trim()} onClick={submit}>
                <Send size={18} />
            </button>
        </div>
    </section></main>;
}

function MessageBubble({
    m,
    own,
    canDelete,
    onDelete
}: {
    m: Message;
    own: boolean;
    canDelete: boolean;
    onDelete: (id: string) => void;
}) {
    const time = new Date(m.createdAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    const file = m.file;
    const mime = file?.mimeType?.toLowerCase() || "application/octet-stream";
    const isRasterImage = mime === "image/jpeg" || mime === "image/png" ||
        mime === "image/webp" || mime === "image/gif" || mime === "image/bmp" ||
        mime === "image/avif";
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");

    return <div className={`msgrow ${own ? "own" : ""}`}>
        <article className={`bubble ${own ? "ownbubble" : ""}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="sender">{own ? "You" : m.senderName}</span>
                {canDelete && !m.deleted && <button className="tiny" title="Delete" onClick={() => onDelete(m.id)}><Trash2 size={14} /></button>}
            </div>

            {m.deleted ? <p className="deleted">This message was deleted</p> :
                m.type === "TEXT" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> :
                    !file ? <p className="muted">File metadata is unavailable.</p> :
                        isRasterImage ? <div>
                            <a href={file.url} target="_blank" rel="noreferrer">
                                <img className="chat-image" src={file.url} alt={file.originalName} loading="lazy" />
                            </a>
                            <p className="filecaption">{file.originalName}</p>
                        </div> :
                            isVideo ? <div>
                                <video className="max-w-full rounded-lg" controls preload="metadata">
                                    <source src={file.url} type={mime} />
                                </video>
                                <p className="filecaption">{file.originalName}</p>
                                <FileCard messageId={m.id} file={file} icon={<FileVideo size={18} />} />
                            </div> :
                                isAudio ? <div className="space-y-2">
                                    <audio className="w-full" controls preload="metadata">
                                        <source src={file.url} type={mime} />
                                    </audio>
                                    <p className="filecaption">{file.originalName}</p>
                                    <FileCard messageId={m.id} file={file} icon={<FileAudio size={18} />} />
                                </div> :
                                    <FileCard messageId={m.id} file={file} icon={getFileIcon(mime)} />
            }

            <time>{time}</time>
        </article>
    </div>;
}

/**
 * All non-inline files are downloaded through the authenticated backend.
 * The backend creates a short-lived signed Cloudinary download URL. This is
 * intentionally used instead of the public res.cloudinary.com/upload URL so
 * PDF/ZIP delivery works even when public PDF/ZIP delivery is restricted.
 */
function FileCard({
    messageId,
    file,
    icon
}: {
    messageId: string;
    file: NonNullable<Message["file"]>;
    icon: React.ReactNode;
}) {
    const [downloading, setDownloading] = useState(false);

    async function download() {
        if (downloading) return;

        const popup = window.open("about:blank", "_blank");
        if (!popup) {
            window.alert("Please allow pop-ups to download this file.");
            return;
        }

        try {
            setDownloading(true);
            const url = await fileDownloadUrl(messageId);
            popup.location.href = url;
        } catch {
            popup.close();
            window.alert("Unable to download this file. Please try again.");
        } finally {
            setDownloading(false);
        }
    }

    return <button
        type="button"
        className="filecard text-left w-full"
        onClick={download}
        disabled={downloading}
        title={`Download ${file.originalName}`}
    >
        {icon}
        <span className="min-w-0 flex-1">
            <b className="block truncate">{file.originalName}</b>
            <small>{formatFileSize(file.size)} · {file.mimeType || "unknown type"}</small>
        </span>
        <Download size={18} className={downloading ? "animate-pulse" : ""} />
    </button>;
}

function getFileIcon(mime: string) {
    if (mime.startsWith("image/")) return <FileImage size={18} />;
    if (mime.startsWith("video/")) return <FileVideo size={18} />;
    if (mime.startsWith("audio/")) return <FileAudio size={18} />;
    if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("tar")) {
        return <FileArchive size={18} />;
    }
    return <FileText size={18} />;
}

function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

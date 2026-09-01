import { useEffect, useRef, useState } from "react";
import { ArrowDown, Download, FileArchive, FileAudio, FileImage, FileText, Paperclip, Reply, Send, Trash2, Wifi, WifiOff, X, SmilePlus } from "lucide-react";
import { deleteMessage, fileDownloadUrl, messages, sendFile, sendText } from "../api";
import { Message, User } from "../types";
import { KlipyPicker } from "../components/KlipyPicker";

export function ChatPage({ user, incomingMessage, connected }: { user: User; incomingMessage: Message | null; connected: boolean; }) {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [nearBottom, setNearBottom] = useState(true);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const end = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!incomingMessage) return;
        setMsgs(current => {
            if (current.some(message => message.id === incomingMessage.id)) {
                return current.map(message => message.id === incomingMessage.id ? incomingMessage : message);
            }
            return [...current, incomingMessage].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
    }, [incomingMessage]);

    useEffect(() => {
        messages().then(setMsgs).catch(() => setError("Unable to load messages."));
    }, []);

    function scrollToBottom(behavior: ScrollBehavior = "smooth") {
        if (!nearBottom) return;

        // The first frame happens before the browser has fully laid out
        // newly inserted media. A second frame catches the final layout.
        requestAnimationFrame(() => {
            end.current?.scrollIntoView({ behavior, block: "end" });
            requestAnimationFrame(() => {
                end.current?.scrollIntoView({ behavior, block: "end" });
            });
        });
    }

    useEffect(() => {
        scrollToBottom();
    }, [msgs]);

    function handleMediaLoaded() {
        // GIFs/stickers get their intrinsic height only after the media loads.
        // Re-scroll after that happens so the viewport reaches the true bottom.
        if (!nearBottom) return;
        scrollToBottom("auto");
    }

    function scroll() {
        const e = list.current;
        if (!e) return;
        setNearBottom(e.scrollHeight - e.scrollTop - e.clientHeight < 100);
    }

    function replyTo(message: Message) {
        setReplyingTo(message);
        requestAnimationFrame(() => document.getElementById("chat-composer")?.focus());
    }

    function jumpToMessage(id: string) {
        const element = messageRefs.current[id];
        if (!element) return;
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-indigo-400", "rounded-xl");
        window.setTimeout(() => element.classList.remove("ring-2", "ring-indigo-400", "rounded-xl"), 1200);
    }

    function cancelReply() { setReplyingTo(null); }

    async function submit() {
        if (!text.trim() || !connected) return;
        try {
            await sendText(text, replyingTo?.id);
            setText("");
            setReplyingTo(null);
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
            const meta = await (await import("../api")).upload(f, setProgress);
            await sendFile(meta, replyingTo?.id);
            setReplyingTo(null);
        } catch (e: any) {
            setError(e.response?.data?.message || "Upload failed.");
        } finally {
            setProgress(null);
        }
    }

    async function remove(id: string) {
        try { await deleteMessage(id); }
        catch (e: any) { setError(e.response?.data?.message || "Delete failed."); }
    }

    return <main className="page"><section className="chat-shell">
        <div className="chat-head"><div><h1 className="font-bold text-lg">Campus Group</h1><p className="muted text-xs">Everyone can chat here</p></div><div className={`status ${connected ? "online" : "offline"}`}>{connected ? <Wifi size={14}/> : <WifiOff size={14}/>} {connected ? "Connected" : "Reconnecting…"}</div></div>

        <div ref={list} onScroll={scroll} className="message-list">
            {msgs.map(m => <div key={m.id} ref={element => { messageRefs.current[m.id] = element; }}><MessageBubble m={m} own={m.senderId === user.id} canDelete={m.senderId === user.id || user.role === "ADMIN"} onDelete={remove} onReply={replyTo} onJump={jumpToMessage} onMediaLoaded={handleMediaLoaded}/></div>)}
            <div ref={end}/>
        </div>

        {!nearBottom && <button className="newmsg" onClick={() => { setNearBottom(true); requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" })); }}><ArrowDown size={15}/>New messages</button>}
        {error && <div className="px-4 pb-2"><div className="error">{error}<button onClick={() => setError("")}>×</button></div></div>}
        {progress !== null && <div className="px-4 pb-2"><div className="uploadbar"><div style={{width:`${progress}%`}}/></div><span className="muted text-xs">Uploading… {progress}%</span></div>}
        {replyingTo && <ReplyComposerPreview message={replyingTo} onCancel={cancelReply} onJump={jumpToMessage}/>} 

        <div className="composer">
            <label className="iconbtn cursor-pointer" title={replyingTo ? "Attach file as reply" : "Attach any file"}><Paperclip size={20}/><input hidden type="file" onChange={attach}/></label>
            <button type="button" className="iconbtn" title="GIFs & Stickers" onClick={() => setShowMediaPicker(true)}><SmilePlus size={20}/></button>
            <textarea id="chat-composer" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape" && replyingTo) cancelReply(); }} placeholder={replyingTo ? "Reply to message…" : "Type a message…"} rows={1}/>
            <button className="btn-primary send" disabled={!connected || !text.trim()} onClick={submit}><Send size={18}/></button>
        </div>

        {showMediaPicker && <KlipyPicker replyToMessageId={replyingTo?.id} onClose={() => setShowMediaPicker(false)}/>} 
    </section></main>;
}

function ReplyComposerPreview({ message, onCancel, onJump }: { message: Message; onCancel: () => void; onJump: (id: string) => void; }) {
    return <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"><button type="button" className="text-left flex-1 min-w-0" onClick={() => onJump(message.id)} title="Jump to original message"><div className="flex items-center gap-2 text-xs font-semibold"><Reply size={14}/>Replying to {message.senderName}</div><div className="text-sm muted truncate mt-0.5">{messagePreview(message)}</div></button><button type="button" className="iconbtn" onClick={onCancel} title="Cancel reply"><X size={18}/></button></div>;
}

function MessageBubble({m, own, canDelete, onDelete, onReply, onJump, onMediaLoaded}: {m: Message; own: boolean; canDelete: boolean; onDelete: (id: string) => void; onReply: (message: Message) => void; onJump: (id: string) => void; onMediaLoaded: () => void;}) {
    const time = new Date(m.createdAt).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});
    const file = m.file;
    const media = m.media;
    const mime = file?.mimeType?.toLowerCase() || "application/octet-stream";
    const isRasterImage = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"].includes(mime);
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");

    return <div className={`msgrow ${own ? "own" : ""}`}><article className={`bubble ${own ? "ownbubble" : ""}`}>
        <div className="flex items-center justify-between gap-3"><span className="sender">{own ? "You" : m.senderName}</span><div className="flex items-center gap-1"><button className="tiny" title="Reply" onClick={() => onReply(m)}><Reply size={14}/></button>{canDelete && !m.deleted && <button className="tiny" title="Delete" onClick={() => onDelete(m.id)}><Trash2 size={14}/>}</div></div>
        {m.replyTo && <ReplyQuote reply={m.replyTo} onClick={() => onJump(m.replyTo!.messageId)}/>} 
        {m.deleted ? <p className="deleted">This message was deleted</p> : m.type === "TEXT" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : m.type === "GIF" || m.type === "STICKER" ? <MediaBubble media={media} type={m.type} onLoaded={onMediaLoaded}/> : !file ? <p className="muted">File metadata is unavailable.</p> : isRasterImage ? <div><a href={file.url} target="_blank" rel="noreferrer"><img className="chat-image" src={file.url} alt={file.originalName} loading="lazy" onLoad={onMediaLoaded}/></a><p className="filecaption">{file.originalName}</p></div> : isVideo ? <div><video className="max-w-full rounded-lg" controls preload="metadata" onLoadedMetadata={onMediaLoaded}><source src={file.url} type={mime}/></video><p className="filecaption">{file.originalName}</p><FileCard messageId={m.id} file={file} icon={<FileVideo size={18}/>} /></div> : isAudio ? <div className="space-y-2"><audio className="w-full" controls preload="metadata" onLoadedMetadata={onMediaLoaded}><source src={file.url} type={mime}/></audio><p className="filecaption">{file.originalName}</p><FileCard messageId={m.id} file={file} icon={<FileAudio size={18}/>} /></div> : <FileCard messageId={m.id} file={file} icon={getFileIcon(mime)}/>}<time>{time}</time>
    </article></div>;
}

function MediaBubble({media, type, onLoaded}: {media: Message["media"]; type: "GIF" | "STICKER"; onLoaded: () => void;}) {
    if (!media?.url) return <p className="muted">Media unavailable.</p>;
    return <div className={type === "STICKER" ? "flex justify-center" : "max-w-sm"}><img src={media.url} alt={media.title || type} loading="lazy" onLoad={onLoaded} className={type === "STICKER" ? "max-w-[180px] max-h-[180px] object-contain" : "max-w-full rounded-lg"}/></div>;
}

function ReplyQuote({reply,onClick}:{reply:NonNullable<Message["replyTo"]>;onClick:()=>void}){return <button type="button" onClick={onClick} className="w-full text-left mb-2 rounded-md border-l-4 border-indigo-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Jump to replied message"><div className="text-xs font-semibold truncate">{reply.senderName}</div><div className="text-xs muted truncate mt-0.5">{reply.deleted ? "This message was deleted" : replyPreview(reply)}</div></button>}
function messagePreview(message:Message){if(message.deleted)return "This message was deleted";if(message.type==="TEXT")return message.content||"Message";if(message.type==="IMAGE")return `📷 ${message.file?.originalName||"Photo"}`;if(message.type==="GIF")return "🎞️ GIF";if(message.type==="STICKER")return "🏷️ Sticker";return `📎 ${message.file?.originalName||"File"}`;}
function replyPreview(reply:NonNullable<Message["replyTo"]>){if(reply.type==="TEXT")return reply.content||"Message";if(reply.type==="IMAGE")return `📷 ${reply.fileName||"Photo"}`;if(reply.type==="GIF")return "🎞️ GIF";if(reply.type==="STICKER")return "🏷️ Sticker";return `📎 ${reply.fileName||"File"}`;}
function FileCard({messageId,file,icon}:{messageId:string;file:NonNullable<Message["file"]>;icon:React.ReactNode}){const[downloading,setDownloading]=useState(false);async function download(){if(downloading)return;const popup=window.open("about:blank","_blank");if(!popup){window.alert("Please allow pop-ups to download this file.");return;}try{setDownloading(true);const url=await fileDownloadUrl(messageId);popup.location.href=url;}catch{popup.close();window.alert("Unable to download this file. Please try again.");}finally{setDownloading(false);}}return <button type="button" className="filecard text-left w-full" onClick={download} disabled={downloading} title={`Download ${file.originalName}`}>{icon}<span className="min-w-0 flex-1"><b className="block truncate">{file.originalName}</b><small>{formatFileSize(file.size)} · {file.mimeType || "unknown type"}</small></span><Download size={18} className={downloading ? "animate-pulse" : ""}/></button>}
function getFileIcon(mime:string){if(mime.startsWith("image/"))return <FileImage size={18}/>;if(mime.startsWith("video/"))return <FileVideo size={18}/>;if(mime.startsWith("audio/"))return <FileAudio size={18}/>;if(mime.includes("zip")||mime.includes("rar")||mime.includes("7z")||mime.includes("tar"))return <FileArchive size={18}/>;return <FileText size={18}/>;}
function formatFileSize(size:number){if(size<1024)return `${size} B`;if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;if(size<1024*1024*1024)return `${(size/(1024*1024)).toFixed(2)} MB`;return `${(size/(1024*1024*1024)).toFixed(2)} GB`;}

import { useEffect, useRef, useState } from "react"; import { Paperclip, Send, Trash2, Wifi, WifiOff, ArrowDown, Download } from "lucide-react";
import { deleteMessage, messages, sendFile, sendText, upload } from "../api"; import { Message, User } from "../types"; import { useSocket } from "../hooks/useSocket";
export function ChatPage({ user }: { user: User }) {
    const [msgs, setMsgs] = useState<Message[]>([]); const [text, setText] = useState(""); const [progress, setProgress] = useState<number | null>(null); const [error, setError] = useState(""); const [nearBottom, setNearBottom] = useState(true); const end = useRef<HTMLDivElement>(null); const list = useRef<HTMLDivElement>(null);
    const add = (m: Message) => setMsgs(x => x.some(a => a.id === m.id) ? x.map(a => a.id === m.id ? m : a) : [...x, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    const { connected } = useSocket(add, () => { }, () => { });
    useEffect(() => { messages().then(setMsgs).catch(() => setError("Unable to load messages.")) }, []);
    useEffect(() => { if (nearBottom) end.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, nearBottom]);
    function scroll() { const e = list.current; if (!e) return; setNearBottom(e.scrollHeight - e.scrollTop - e.clientHeight < 100) }
    async function submit() { if (!text.trim() || !connected) return; try { await sendText(text); setText("") } catch (e: any) { setError(e.response?.data?.message || "Send failed.") } }
    async function attach(e: any) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setProgress(0); const meta = await upload(f, setProgress); await sendFile(meta) } catch (e: any) { setError(e.response?.data?.message || "Upload failed.") } finally { setProgress(null) } }
    async function remove(id: string) { try { await deleteMessage(id) } catch (e: any) { setError(e.response?.data?.message || "Delete failed.") } }
    return <main className="page"><section className="chat-shell">
        <div className="chat-head"><div><h1 className="font-bold text-lg">Campus Group</h1><p className="muted text-xs">Everyone can chat here</p></div><div className={`status ${connected ? "online" : "offline"}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />} {connected ? "Connected" : "Reconnecting…"}</div></div>
        <div ref={list} onScroll={scroll} className="message-list">{msgs.map(m => <MessageBubble key={m.id} m={m} own={m.senderId === user.id} canDelete={m.senderId === user.id || user.role === "ADMIN"} onDelete={remove} />)}<div ref={end} /></div>
        {!nearBottom && <button className="newmsg" onClick={() => { end.current?.scrollIntoView({ behavior: "smooth" }); setNearBottom(true) }}><ArrowDown size={15} />New messages</button>}
        {error && <div className="px-4 pb-2"><div className="error">{error}<button onClick={() => setError("")}>×</button></div></div>}
        {progress !== null && <div className="px-4 pb-2"><div className="uploadbar"><div style={{ width: `${progress}%` }} /></div><span className="muted text-xs">Uploading… {progress}%</span></div>}
        <div className="composer"><label className="iconbtn cursor-pointer"><Paperclip size={20} /><input hidden type="file" onChange={attach} /></label><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }} placeholder="Type a message…" rows={1} /><button className="btn-primary send" disabled={!connected || !text.trim()} onClick={submit}><Send size={18} /></button></div>
    </section></main>
}
function MessageBubble({ m, own, canDelete, onDelete }: { m: Message; own: boolean; canDelete: boolean; onDelete: (id: string) => void }) {
    const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return <div className={`msgrow ${own ? "own" : ""}`}><article className={`bubble ${own ? "ownbubble" : ""}`}>
        <div className="flex items-center justify-between gap-3"><span className="sender">{own ? "You" : m.senderName}</span>{canDelete && !m.deleted && <button className="tiny" title="Delete" onClick={() => onDelete(m.id)}><Trash2 size={14} /></button>}</div>
        {m.deleted ? <p className="deleted">This message was deleted</p> : m.type === "TEXT" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : m.type === "IMAGE" ? <div><a href={m.file!.url} target="_blank" rel="noreferrer"><img className="chat-image" src={m.file!.url} alt={m.file!.originalName} /></a><p className="filecaption">{m.file!.originalName}</p></div> : <a className="filecard" href={m.file!.url} target="_blank" rel="noreferrer"><Download size={18} /><span><b>{m.file!.originalName}</b><small>{(m.file!.size / 1024 / 1024).toFixed(2)} MB</small></span></a>}
        <time>{time}</time></article></div>
}

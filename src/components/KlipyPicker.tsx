import { useEffect, useMemo, useState } from "react";
import { Link2, Search, Send, X } from "lucide-react";
import { savedMedia, sendMedia, sendMediaLink, sendSavedMedia } from "../api";
import type { SavedMedia } from "../types";

type Kind = "GIF" | "STICKER";
type Tab = Kind | "LINKS";
type DirectKind = "AUTO" | "GIF" | "IMAGE" | "VIDEO";
type Item = {
    id: string;
    title?: string;
    media_formats?: Record<string, { url?: string; preview?: string; dims?: number[] }>;
};

const KEY = import.meta.env.VITE_KLIPY_API_KEY as string | undefined;
const BASE = "https://api.klipy.com";
const STARTER_GIF = "https://static.klipy.com/ii/d6b0ce929193df3c242ac34b5654d2ce/d8/71/iaYWp9nI.gif";

function media(item: Item, kind: Kind) {
    const formats = item.media_formats || {};
    const preferred = kind === "STICKER"
        ? ["webp", "tinywebp", "gif", "tinygif"]
        : ["gif", "mediumgif", "tinygif", "webp"];

    for (const name of preferred) {
        if (formats[name]?.url) {
            return {
                url: formats[name]!.url!,
                previewUrl: formats[name]!.preview || formats[name]!.url!,
                dims: formats[name]!.dims || [],
            };
        }
    }

    const first = Object.values(formats).find((x) => x.url);
    return first
        ? { url: first.url!, previewUrl: first.preview || first.url!, dims: first.dims || [] }
        : null;
}

function detectDirectKind(url: string): DirectKind {
    const clean = url.split("?")[0].split("#")[0].toLowerCase();
    const ext = clean.includes(".") ? clean.substring(clean.lastIndexOf(".") + 1) : "";
    if (ext === "gif") return "GIF";
    if (["jpg", "jpeg", "png", "webp", "bmp", "avif", "svg"].includes(ext)) return "IMAGE";
    if (["mp4", "webm", "mov", "m4v", "ogv"].includes(ext)) return "VIDEO";
    return "AUTO";
}

function SavedTile({ item, onClick, disabled }: { item: SavedMedia; onClick: () => void; disabled: boolean }) {
    const video = item.kind === "VIDEO" || item.mimeType?.startsWith("video/");

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={`${item.title || "Saved media"} • sent ${item.sentCount} time${item.sentCount === 1 ? "" : "s"}`}
            className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition disabled:opacity-60"
        >
            {video ? (
                <video src={item.url} muted loop autoPlay playsInline preload="metadata" className="w-full h-28 object-cover" />
            ) : (
                <img src={item.previewUrl || item.url} alt={item.title || item.kind} loading="lazy" className="w-full h-28 object-contain" />
            )}
            <span className="absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{item.sentCount}×</span>
        </button>
    );
}

function DirectPreview({ url, kind }: { url: string; kind: DirectKind }) {
    if (!url || kind === "AUTO") return null;
    return (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
            {kind === "VIDEO" ? (
                <video src={url} controls preload="metadata" className="max-h-48 w-full rounded-lg" />
            ) : (
                <img src={url} alt="Media preview" className="mx-auto max-h-48 max-w-full object-contain rounded-lg" />
            )}
        </div>
    );
}

export function KlipyPicker({ onClose, replyToMessageId }: { onClose: () => void; replyToMessageId?: string }) {
    const [tab, setTab] = useState<Tab>("GIF");
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<Item[]>([]);
    const [saved, setSaved] = useState<SavedMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [savedLoading, setSavedLoading] = useState(true);
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [link, setLink] = useState("");
    const [directType, setDirectType] = useState<DirectKind>("AUTO");

    const kind: Kind = tab === "STICKER" ? "STICKER" : "GIF";
    const myGifs = useMemo(() => saved.filter((item) => item.kind === "GIF"), [saved]);
    const myStickers = useMemo(() => saved.filter((item) => item.kind === "STICKER"), [saved]);
    const myLinks = useMemo(() => saved.filter((item) => item.provider === "LINK"), [saved]);

    useEffect(() => {
        let cancelled = false;
        async function loadSaved() {
            setSavedLoading(true);
            try {
                const data = await savedMedia();
                if (!cancelled) setSaved(data || []);
            } catch (e: any) {
                if (!cancelled) setError(e.response?.data?.message || "Unable to load your saved media.");
            } finally {
                if (!cancelled) setSavedLoading(false);
            }
        }
        void loadSaved();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (tab === "LINKS") return;
        let cancelled = false;
        async function load() {
            if (!KEY) {
                setError("KLIPY is not configured. Add VITE_KLIPY_API_KEY to your environment variables.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError("");
            try {
                const params = new URLSearchParams({
                    key: KEY,
                    limit: "24",
                    contentfilter: "high",
                    media_filter: kind === "STICKER" ? "webp,tinywebp,gif,tinygif" : "gif,mediumgif,tinygif",
                });
                if (query.trim()) params.set("q", query.trim());
                if (kind === "STICKER") params.set("searchfilter", "sticker");
                const response = await fetch(`${BASE}${query.trim() ? "/v2/search" : "/v2/featured"}?${params}`);
                if (!response.ok) throw new Error(`KLIPY returned ${response.status}`);
                const data = await response.json();
                if (!cancelled) setItems(data.results || []);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Unable to load GIFs.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        const timer = window.setTimeout(load, query.trim() ? 350 : 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [kind, query, tab]);

    function switchTab(next: Tab) {
        setTab(next);
        setQuery("");
        setError("");
    }

    async function choose(item: Item) {
        const selected = media(item, kind);
        if (!selected || sending) return;
        try {
            setSending(true);
            setError("");
            await sendMedia({
                type: kind,
                provider: "KLIPY",
                providerId: item.id,
                title: item.title,
                url: selected.url,
                previewUrl: selected.previewUrl,
                width: selected.dims[0],
                height: selected.dims[1],
                mimeType: kind === "GIF" ? "image/gif" : "image/webp",
            }, replyToMessageId);
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || "Unable to send media.");
            setSending(false);
        }
    }

    async function chooseSaved(item: SavedMedia) {
        if (sending) return;
        try {
            setSending(true);
            setError("");
            await sendSavedMedia(item.id, replyToMessageId);
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || "Unable to send saved media.");
            setSending(false);
        }
    }

    function applyDetectedType(value: string) {
        setLink(value);
        setDirectType(detectDirectKind(value));
    }

    async function submitLink() {
        const value = link.trim();
        if (!value || sending) return;

        try {
            const parsed = new URL(value);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                throw new Error("Only HTTP and HTTPS links are supported.");
            }
        } catch (e: any) {
            setError(e.message || "Please paste a valid image, GIF, or video URL.");
            return;
        }

        const selectedKind = directType === "AUTO" ? detectDirectKind(value) : directType;
        if (selectedKind === "AUTO") {
            setError("This URL has no recognizable media extension. Choose GIF, Image, or Video manually.");
            return;
        }

        try {
            setSending(true);
            setError("");
            await sendMediaLink({
                url: value,
                type: selectedKind === "GIF" ? "GIF" : undefined,
                provider: "LINK",
            }, replyToMessageId);
            setLink("");
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || "Unable to send that direct media link.");
            setSending(false);
        }
    }

    async function starterGif() {
        if (sending) return;
        try {
            setSending(true);
            setError("");
            await sendMediaLink({ url: STARTER_GIF, type: "GIF", provider: "LINK", title: "Starter GIF" }, replyToMessageId);
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || "Unable to send starter GIF.");
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onMouseDown={onClose}>
            <section className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
                <header className="border-b border-slate-200 dark:border-slate-700 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto">
                            <button type="button" className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${tab === "GIF" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`} onClick={() => switchTab("GIF")}>GIFs</button>
                            <button type="button" className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${tab === "STICKER" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`} onClick={() => switchTab("STICKER")}>Stickers</button>
                            <button type="button" className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${tab === "LINKS" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`} onClick={() => switchTab("LINKS")}>Direct Links</button>
                        </div>
                        <button className="iconbtn ml-auto" onClick={onClose} title="Close"><X size={20} /></button>
                    </div>

                    {tab !== "LINKS" ? (
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 muted" size={17} />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${kind.toLowerCase()}…`} className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none" autoFocus />
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Link2 className="absolute left-3 top-2.5 muted" size={17} />
                                    <input value={link} onChange={(e) => applyDetectedType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitLink(); } }} placeholder="Paste a direct image, GIF, or video URL…" className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none" autoFocus />
                                </div>
                                <button type="button" className="btn-primary" disabled={!link.trim() || sending} onClick={() => void submitLink()}><Send size={16} /> Send</button>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="muted">Type:</span>
                                {(["AUTO", "GIF", "IMAGE", "VIDEO"] as DirectKind[]).map((option) => (
                                    <button key={option} type="button" onClick={() => setDirectType(option)} className={`rounded-full px-2.5 py-1 ${directType === option ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "bg-slate-100 dark:bg-slate-800 muted"}`}>
                                        {option === "AUTO" ? "Auto" : option === "IMAGE" ? "Image" : option}
                                    </button>
                                ))}
                            </div>
                            <DirectPreview url={link.trim()} kind={directType === "AUTO" ? detectDirectKind(link.trim()) : directType} />
                        </>
                    )}
                </header>

                <div className="p-3 overflow-y-auto max-h-[65vh]">
                    {error && <div className="error mb-3">{error}</div>}

                    {tab === "LINKS" ? (
                        <>
                            <div className="mb-3">
                                <div className="font-semibold text-sm">Your saved direct links</div>
                                <div className="muted text-xs mt-0.5">Most sent first. These entries keep the original URL exactly as you pasted it.</div>
                            </div>
                            <button type="button" onClick={() => void starterGif()} disabled={sending} className="mb-4 w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
                                <div className="font-semibold text-sm">Use the starter GIF</div>
                                <div className="muted text-xs mt-0.5 break-all">{STARTER_GIF}</div>
                            </button>
                            {savedLoading ? (
                                <div className="py-12 text-center muted">Loading your links…</div>
                            ) : myLinks.length === 0 ? (
                                <div className="py-12 text-center muted">No saved direct links yet.</div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {myLinks.map((item) => <SavedTile key={item.id} item={item} disabled={sending} onClick={() => void chooseSaved(item)} />)}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {((kind === "GIF" ? myGifs : myStickers).length > 0) && (
                                <section className="mb-5">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <div>
                                            <div className="font-semibold text-sm">{kind === "GIF" ? "Your most-sent GIFs" : "Your most-sent stickers"}</div>
                                            <div className="muted text-xs mt-0.5">Saved automatically after you send one.</div>
                                        </div>
                                        <span className="muted text-[11px]">Most sent first</span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {(kind === "GIF" ? myGifs : myStickers).map((item) => <SavedTile key={item.id} item={item} disabled={sending} onClick={() => void chooseSaved(item)} />)}
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="font-semibold text-sm mb-2">{query.trim() ? "Search results" : "Discover"}</div>
                                {loading ? (
                                    <div className="py-12 text-center muted">Loading…</div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {items.map((item) => {
                                            const selected = media(item, kind);
                                            return selected ? (
                                                <button key={item.id} type="button" disabled={sending} onClick={() => void choose(item)} className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition disabled:opacity-60">
                                                    <img src={selected.previewUrl} alt={item.title || kind} loading="lazy" className="w-full h-28 object-contain" />
                                                </button>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                {!loading && !error && items.length === 0 && <div className="py-12 text-center muted">No results found.</div>}
                            </section>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

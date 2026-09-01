import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { sendMedia } from "../api";

type Kind = "GIF" | "STICKER";
type Item = { id: string; title?: string; media_formats?: Record<string, { url?: string; preview?: string; dims?: number[] }>; };

const KEY = import.meta.env.VITE_KLIPY_API_KEY as string | undefined;
const BASE = "https://api.klipy.com";

function media(item: Item, kind: Kind) {
    const formats = item.media_formats || {};
    const preferred = kind === "STICKER" ? ["webp", "tinywebp", "gif", "tinygif"] : ["gif", "mediumgif", "tinygif", "webp"];
    for (const name of preferred) if (formats[name]?.url) return { url: formats[name]!.url!, previewUrl: formats[name]!.preview || formats[name]!.url!, dims: formats[name]!.dims || [] };
    const first = Object.values(formats).find(x => x.url);
    return first ? { url: first.url!, previewUrl: first.preview || first.url!, dims: first.dims || [] } : null;
}

export function KlipyPicker({ onClose, onSend }: { onClose: () => void; onSend: (message: any) => Promise<void> }) {
    const [kind, setKind] = useState<Kind>("GIF");
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!KEY) { setError("KLIPY is not configured. Add VITE_KLIPY_API_KEY."); setLoading(false); return; }
            setLoading(true); setError("");
            try {
                const params = new URLSearchParams({ key: KEY, limit: "24", contentfilter: "high", media_filter: kind === "STICKER" ? "webp,tinywebp,gif,tinygif" : "gif,mediumgif,tinygif" });
                if (query.trim()) { params.set("q", query.trim()); if (kind === "STICKER") params.set("searchfilter", "sticker"); }
                else if (kind === "STICKER") params.set("searchfilter", "sticker");
                const endpoint = query.trim() ? "/v2/search" : "/v2/featured";
                const response = await fetch(`${BASE}${endpoint}?${params}`);
                if (!response.ok) throw new Error(`KLIPY returned ${response.status}`);
                const data = await response.json();
                if (!cancelled) setItems(data.results || []);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Unable to load GIFs.");
            } finally { if (!cancelled) setLoading(false); }
        }
        const timer = window.setTimeout(load, query.trim() ? 350 : 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [kind, query]);

    async function choose(item: Item) {
        const m = media(item, kind); if (!m) return;
        const [width, height] = m.dims;
        await sendMedia({ type: kind, provider: "KLIPY", providerId: item.id, title: item.title, url: m.url, previewUrl: m.previewUrl, width, height });
        onClose();
    }

    return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onMouseDown={onClose}>
        <section className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <header className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 p-3">
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                    <button className={`px-3 py-1.5 rounded-md text-sm ${kind === "GIF" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`} onClick={() => setKind("GIF")}>GIFs</button>
                    <button className={`px-3 py-1.5 rounded-md text-sm ${kind === "STICKER" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`} onClick={() => setKind("STICKER")}>Stickers</button>
                </div>
                <div className="relative flex-1"><Search className="absolute left-3 top-2.5 muted" size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${kind.toLowerCase()}…`} className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none" autoFocus /></div>
                <button className="iconbtn" onClick={onClose}><X size={20} /></button>
            </header>
            <div className="p-3 overflow-y-auto max-h-[65vh]">
                {error && <div className="error mb-3">{error}</div>}
                {loading ? <div className="py-12 text-center muted">Loading…</div> : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {items.map(item => { const m = media(item, kind); return m ? <button key={item.id} onClick={() => choose(item)} className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition"><img src={m.previewUrl} alt={item.title || kind} loading="lazy" className="w-full h-28 object-contain" /></button> : null; })}
                </div>}
                {!loading && !error && items.length === 0 && <div className="py-12 text-center muted">No results found.</div>}
                <div className="pt-3 text-center text-[10px] muted">Powered by KLIPY</div>
            </div>
        </section>
    </div>;
}

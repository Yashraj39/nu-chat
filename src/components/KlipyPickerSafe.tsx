import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { client, sendMedia } from "../api";

type Kind = "GIF" | "STICKER";
type Item = {
  id: string;
  title?: string;
  media_formats?: Record<string, { url?: string; preview?: string; dims?: number[] }>;
};
type Props = { onClose: () => void; replyToMessageId?: string };

const KEY = import.meta.env.VITE_KLIPY_API_KEY as string | undefined;

function pick(x: Item, kind: Kind) {
  const formats = x.media_formats || {};
  const names = kind === "STICKER"
    ? ["webp", "tinywebp", "gif", "tinygif"]
    : ["gif", "mediumgif", "tinygif", "webp"];

  for (const name of names) {
    const format = formats[name];
    if (format?.url) {
      return {
        url: format.url,
        preview: format.preview || format.url,
        dims: format.dims || []
      };
    }
  }
  return null;
}

export function KlipyPicker({ onClose, replyToMessageId }: Props) {
  const [tab, setTab] = useState<Kind>("GIF");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!KEY) {
      setError("KLIPY is not configured. Add VITE_KLIPY_API_KEY.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          key: KEY,
          limit: "24",
          contentfilter: "high",
          media_filter: tab === "STICKER" ? "webp,tinywebp,gif,tinygif" : "gif,mediumgif,tinygif"
        });

        const cleanQuery = query.trim();
        if (cleanQuery) params.set("q", cleanQuery);
        if (tab === "STICKER") params.set("searchfilter", "sticker");

        const response = await client.get(cleanQuery ? "/api/klipy/search" : "/api/klipy/featured", { params });
        if (!cancelled) setItems(response.data?.results || []);
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.message || e.message || "Unable to load GIFs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, query]);

  async function sendK(x: Item) {
    const media = pick(x, tab);
    if (!media || busy) return;

    try {
      setBusy(true);
      setError("");
      await sendMedia(
        {
          type: tab,
          provider: "KLIPY",
          providerId: x.id,
          title: x.title,
          url: media.url,
          previewUrl: media.preview,
          width: media.dims[0],
          height: media.dims[1]
        },
        replyToMessageId
      );
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || "Unable to send media.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onMouseDown={onClose}>
      <section
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-sm ${tab === "GIF" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`}
                onClick={() => { setTab("GIF"); setError(""); }}
              >GIFs</button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-sm ${tab === "STICKER" ? "bg-white dark:bg-slate-700 shadow" : "muted"}`}
                onClick={() => { setTab("STICKER"); setError(""); }}
              >Stickers</button>
            </div>
            <button type="button" className="iconbtn ml-auto" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 muted" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab.toLowerCase()}…`}
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none"
              autoFocus
            />
          </div>
        </header>

        <div className="p-3 overflow-y-auto max-h-[65vh]">
          {error && <div className="error mb-3">{error}</div>}

          <div className="font-semibold text-sm mb-2">{query.trim() ? "Search results" : "Discover"}</div>
          {loading ? (
            <div className="py-12 text-center muted">Loading…</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((x) => {
                const media = pick(x, tab);
                return media ? (
                  <button
                    key={x.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendK(x)}
                    className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition disabled:opacity-60"
                  >
                    <img src={media.preview} alt={x.title || tab} loading="lazy" className="w-full h-28 object-contain" />
                  </button>
                ) : null;
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

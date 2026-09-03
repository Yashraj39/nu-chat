import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { gameAction, gameState } from "../api";
import type { GameState } from "../types";

export function TicTacToeRestart({ roomId }: { roomId: string }) {
    const [state, setState] = useState<GameState | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const finished = useMemo(() => {
        if (!state || state.gameType !== "OX") return false;
        return Boolean(state.state?.winner);
    }, [state]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const current = await gameState(roomId);
                if (!cancelled) setState(current);
            } catch {
                // The game room itself handles the main error state.
            }
        }

        void load();
        const timer = window.setInterval(() => void load(), 1000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [roomId]);

    if (!finished) return null;

    async function restart() {
        if (busy) return;

        try {
            setBusy(true);
            setError("");
            const updated = await gameAction(roomId, "restart");
            setState(updated);
        } catch (e: any) {
            setError(e?.response?.data?.message || "Unable to restart the game.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
            <button
                type="button"
                className="btn-primary flex items-center gap-2"
                disabled={busy}
                onClick={() => void restart()}
            >
                <RotateCcw size={17} />
                {busy ? "Restarting…" : "Restart Game"}
            </button>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}

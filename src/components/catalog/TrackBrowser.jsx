import { useMemo, useState } from "react";
import { CATEGORIES } from "../../lib/catalog.js";

export default function TrackBrowser({ tracks, onPickReplace }) {
  const [query, setQuery] = useState("");
  const [showStats, setShowStats] = useState(false);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({
      category,
      tracks: tracks
        .filter((t) => t.category === category)
        .filter((t) => !q || t.id.toLowerCase().includes(q) || t.titles.en.toLowerCase().includes(q))
        .sort((a, b) => a.order - b.order),
    })).filter((g) => g.tracks.length > 0);
  }, [tracks, query]);

  const stats = useMemo(() => {
    return CATEGORIES.map((category) => {
      const inCategory = tracks.filter((t) => t.category === category);
      const orders = inCategory.map((t) => t.order).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < orders.length; i++) {
        if (orders[i] - orders[i - 1] > 1) gaps.push(`${orders[i - 1]}→${orders[i]}`);
      }
      return {
        category,
        count: inCategory.length,
        isProCount: inCategory.filter((t) => t.isPro).length,
        gaps,
      };
    });
  }, [tracks]);

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by id or title to replace…"
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => setShowStats((s) => !s)}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          {showStats ? "Hide" : "Catalog stats"}
        </button>
      </div>

      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {stats.map((s) => (
            <div key={s.category} className="rounded-lg bg-zinc-50 p-2">
              <p className="font-medium text-zinc-700">{s.category}</p>
              <p className="text-zinc-500">{s.count} tracks · {s.isProCount} pro</p>
              {s.gaps.length > 0 && <p className="text-amber-600">order gaps: {s.gaps.join(", ")}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto flex flex-col divide-y divide-zinc-100">
        {grouped.length === 0 && <p className="text-sm text-zinc-400 py-2">No matches.</p>}
        {grouped.map((g) => (
          <div key={g.category} className="py-2">
            <p className="text-xs font-medium uppercase text-zinc-400 mb-1">{g.category}</p>
            {g.tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => onPickReplace(t)}
                className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-indigo-50 text-left"
              >
                <span className="truncate">{t.titles.en} <span className="text-zinc-400">({t.id})</span></span>
                <span className="text-xs text-zinc-400 shrink-0">#{t.order}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

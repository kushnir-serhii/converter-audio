export default function EngineStatus({ engineState, onRetry }) {
  if (engineState === "ready") return null;

  if (engineState === "error") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center justify-between gap-3">
        <span>Couldn't load the converter engine. Check your connection and refresh.</span>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span>Loading converter engine… (one-time, ~30 MB)</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-indigo-500" />
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

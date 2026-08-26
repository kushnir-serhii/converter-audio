import { useEffect, useRef } from "react";

/**
 * A full-viewport dialog for work that needs room — corner picking in
 * particular, where the inline canvas is too small to place a point precisely.
 */
export default function Modal({ open, onClose, title, children }) {
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const downOnBackdrop = useRef(false);
  const restoreFocus = useRef(null);

  useEffect(() => {
    if (!open) return;

    restoreFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Put focus back where it was, so closing doesn't strand the keyboard.
      if (restoreFocus.current && restoreFocus.current.focus) restoreFocus.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900/80 p-3 sm:p-6"
      // Only a click that both started AND ended on the backdrop closes the
      // dialog. Without this, dragging a corner and releasing past the edge of
      // the canvas would count as a backdrop click and throw away the work.
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === backdropRef.current;
      }}
      onClick={(e) => {
        if (e.target === backdropRef.current && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">{title}</p>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            Done <span className="ml-1 text-xs text-zinc-400">Esc</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

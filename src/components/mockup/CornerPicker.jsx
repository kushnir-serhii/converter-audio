import { useEffect, useRef, useState } from "react";
import { loupePlacement, naturalToClient } from "../../lib/loupe.js";

const EDITOR_MAX = 1400; // canvas internal resolution cap (long edge), for performance on large photos
const EDITOR_MAX_FULLSCREEN = 2400; // the dialog displays it far larger, so it needs more pixels
const HANDLE_HIT_PX = 16; // pointer hit radius, in on-screen CSS pixels
const LOUPE_SIZE = 160;
const LOUPE_GAP = 24;
const LOUPE_ZOOM = 4.5;
const LABELS = ["TL", "TR", "BR", "BL"];

export default function CornerPicker({
  image,
  naturalW,
  naturalH,
  quad,
  onChange,
  onReset,
  fullscreen = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const [selected, setSelected] = useState(0);
  const [focused, setFocused] = useState(false);
  const [loupe, setLoupe] = useState(null); // pointer-driven: { natX, natY, clientX, clientY }
  const [tick, setTick] = useState(0); // re-anchors the keyboard loupe on scroll/resize

  const editorMax = fullscreen ? EDITOR_MAX_FULLSCREEN : EDITOR_MAX;
  const scale = Math.min(1, editorMax / Math.max(naturalW, naturalH));
  const editorW = Math.round(naturalW * scale);
  const editorH = Math.round(naturalH * scale);

  // Draw the scene + quad overlay whenever anything relevant changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = editorW;
    canvas.height = editorH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, editorW, editorH);
    ctx.drawImage(image, 0, 0, editorW, editorH);

    if (!quad) return;
    const pts = quad.map(([x, y]) => [x * scale, y * scale]);

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(79, 70, 229, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.stroke();

    pts.forEach(([x, y], i) => {
      const active = i === dragIndex || i === selected;
      ctx.beginPath();
      ctx.arc(x, y, active ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#4f46e5" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.stroke();

      // A ring marks which corner the arrow keys will move.
      if (i === selected) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(79, 70, 229, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillStyle = "#312e81";
      ctx.textAlign = "center";
      const labelY = y < 16 ? y + 20 : y - 12;
      ctx.fillText(LABELS[i], x, labelY);
    });
  }, [image, quad, editorW, editorH, scale, dragIndex, selected]);

  useEffect(() => {
    if (fullscreen) canvasRef.current?.focus();
  }, [fullscreen]);

  // In the large view the whole dialog is a corner editor, so arrow keys keep
  // adjusting the selected corner even after clicking somewhere off the canvas
  // — otherwise a stray click silently stops the keyboard from working.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => {
      const delta = NUDGE[e.key];
      if (!delta) return;
      // The canvas has its own handler; without this both would fire and every
      // press would move the corner twice.
      if (e.target === canvasRef.current) return;
      const tag = e.target?.tagName;
      // Leave form controls alone; arrows mean something else inside them.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      nudge(delta, e.shiftKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // While the canvas has focus the magnifier is anchored to a corner in the
  // page, so it has to be repositioned whenever the page moves under it.
  useEffect(() => {
    if (!focused) return;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, [focused]);

  const eventToEditorPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ratioX = canvasRef.current.width / rect.width;
    const ratioY = canvasRef.current.height / rect.height;
    return [(e.clientX - rect.left) * ratioX, (e.clientY - rect.top) * ratioY];
  };

  const nearestHandle = (ex, ey) => {
    if (!quad) return -1;
    const rect = canvasRef.current.getBoundingClientRect();
    const pxPerEditor = rect.width / canvasRef.current.width;
    const thresholdEditor = HANDLE_HIT_PX / pxPerEditor;
    let best = -1;
    let bestDist = Infinity;
    quad.forEach(([x, y], i) => {
      const dx = x * scale - ex;
      const dy = y * scale - ey;
      const dist = Math.hypot(dx, dy);
      if (dist < thresholdEditor && dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return best;
  };

  const updateLoupe = (e, natX, natY) => {
    setLoupe({ natX, natY, clientX: e.clientX, clientY: e.clientY });
  };

  const handlePointerDown = (e) => {
    const [ex, ey] = eventToEditorPoint(e);
    const idx = nearestHandle(ex, ey);
    if (idx === -1) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(idx);
    setDragIndex(idx);
    updateLoupe(e, quad[idx][0], quad[idx][1]);
  };

  const handlePointerMove = (e) => {
    if (dragIndex === -1) return;
    const [ex, ey] = eventToEditorPoint(e);
    const clampedX = Math.min(Math.max(ex, 0), editorW);
    const clampedY = Math.min(Math.max(ey, 0), editorH);
    const natX = clampedX / scale;
    const natY = clampedY / scale;
    const next = quad.map((p, i) => (i === dragIndex ? [natX, natY] : p));
    onChange(next);
    updateLoupe(e, natX, natY);
  };

  const handlePointerUp = (e) => {
    if (dragIndex === -1) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragIndex(-1);
    setLoupe(null); // the keyboard-anchored loupe below takes over while focused
  };

  const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  // One image pixel per press, ten with Shift. Working in the image's own
  // pixels (not screen pixels) means a nudge is the same size whatever the
  // canvas happens to be scaled to on screen.
  const nudge = (delta, big) => {
    if (!quad) return;
    const stepPx = big ? 10 : 1;
    onChange(
      quad.map((p, i) =>
        i === selected
          ? [
              Math.min(Math.max(p[0] + delta[0] * stepPx, 0), naturalW),
              Math.min(Math.max(p[1] + delta[1] * stepPx, 0), naturalH),
            ]
          : p
      )
    );
  };

  const handleKeyDown = (e) => {
    if (!quad) return;

    // Tab / Shift+Tab cycles which corner the arrows drive. Only while the
    // canvas itself has focus, so Tab can still reach the dialog's buttons.
    if (e.key === "Tab") {
      e.preventDefault();
      setSelected((i) => (i + (e.shiftKey ? 3 : 1)) % 4);
      return;
    }

    const delta = NUDGE[e.key];
    if (!delta) return;
    e.preventDefault();
    nudge(delta, e.shiftKey);
  };

  // Pointer dragging anchors the magnifier to the cursor; otherwise, while the
  // canvas has focus, it anchors to the selected corner so arrow-key nudges are
  // visible at pixel level too.
  const loupeView = (() => {
    void tick; // recomputed whenever the page scrolls or resizes under us
    const canvas = canvasRef.current;
    if (!canvas || !image) return null;

    if (loupe) {
      const { left, top } = loupePlacement(
        loupe.clientX,
        loupe.clientY,
        LOUPE_SIZE,
        LOUPE_GAP,
        window.innerWidth,
        window.innerHeight
      );
      return { natX: loupe.natX, natY: loupe.natY, left, top };
    }

    // The large view is a dedicated editor, so the magnifier stays up there
    // regardless of what currently holds focus.
    if ((!focused && !fullscreen) || !quad || selected < 0) return null;
    const [natX, natY] = quad[selected];
    const rect = canvas.getBoundingClientRect();
    const anchor = naturalToClient(rect, natX, natY, naturalW, naturalH);
    const { left, top } = loupePlacement(
      anchor.x,
      anchor.y,
      LOUPE_SIZE,
      LOUPE_GAP,
      window.innerWidth,
      window.innerHeight
    );
    return { natX, natY, left, top };
  })();

  return (
    <div
      ref={containerRef}
      className={fullscreen ? "relative flex min-h-0 flex-1 flex-col gap-2" : "relative"}
    >
      <div
        className={
          fullscreen
            ? "flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            : "contents"
        }
      >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Screen corner positions — click a corner, then use arrow keys to adjust"
        className={`rounded-xl border border-zinc-200 touch-none cursor-crosshair focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          fullscreen ? "max-h-full max-w-full" : "max-w-full h-auto"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      </div>
      <div className="mt-2 flex shrink-0 items-center justify-between">
        <p className="text-xs text-zinc-500">
          Drag the corners onto the screen, or click one and nudge with the arrow keys —
          <span className="font-medium text-zinc-600"> {LABELS[selected]}</span> selected,
          Shift for 10px, Tab for the next corner.
        </p>
        <button
          onClick={onReset}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 shrink-0 ml-3"
        >
          Reset corners
        </button>
      </div>
      {loupeView && (
        <Loupe
          image={image}
          natX={loupeView.natX}
          natY={loupeView.natY}
          left={loupeView.left}
          top={loupeView.top}
        />
      )}
    </div>
  );
}

function Loupe({ image, natX, natY, left, top }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

    const span = LOUPE_SIZE / LOUPE_ZOOM;
    const sx = natX - span / 2;
    const sy = natY - span / 2;
    ctx.drawImage(image, sx, sy, span, span, 0, 0, LOUPE_SIZE, LOUPE_SIZE);

    ctx.strokeStyle = "rgba(79, 70, 229, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOUPE_SIZE / 2, 0);
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
    ctx.moveTo(0, LOUPE_SIZE / 2);
    ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [image, natX, natY]);

  return (
    <canvas
      ref={ref}
      width={LOUPE_SIZE}
      height={LOUPE_SIZE}
      className="pointer-events-none fixed z-50 rounded-full shadow-lg"
      style={{ left, top }}
    />
  );
}

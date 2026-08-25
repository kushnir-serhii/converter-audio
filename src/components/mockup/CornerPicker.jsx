import { useEffect, useRef, useState } from "react";

const EDITOR_MAX = 1400; // canvas internal resolution cap (long edge), for performance on large photos
const HANDLE_HIT_PX = 16; // pointer hit radius, in on-screen CSS pixels
const LOUPE_SIZE = 160;
const LOUPE_ZOOM = 4.5;
const LABELS = ["TL", "TR", "BR", "BL"];

export default function CornerPicker({ image, naturalW, naturalH, quad, onChange, onReset }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const [loupe, setLoupe] = useState(null); // { natX, natY, clientX, clientY }

  const scale = Math.min(1, EDITOR_MAX / Math.max(naturalW, naturalH));
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
      ctx.beginPath();
      ctx.arc(x, y, i === dragIndex ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = i === dragIndex ? "#4f46e5" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillStyle = "#312e81";
      ctx.textAlign = "center";
      const labelY = y < 16 ? y + 20 : y - 12;
      ctx.fillText(LABELS[i], x, labelY);
    });
  }, [image, quad, editorW, editorH, scale, dragIndex]);

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
    e.currentTarget.setPointerCapture(e.pointerId);
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
    setLoupe(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded-xl border border-zinc-200 touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Drag the 4 corners onto the screen in the photo — TL → TR → BR → BL.
        </p>
        <button
          onClick={onReset}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 shrink-0 ml-3"
        >
          Reset corners
        </button>
      </div>
      {loupe && <Loupe image={image} {...loupe} />}
    </div>
  );
}

function Loupe({ image, natX, natY, clientX, clientY }) {
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

  // Positioned above-left of the cursor, in viewport (fixed) coordinates.
  const left = Math.min(Math.max(clientX - LOUPE_SIZE - 24, 8), window.innerWidth - LOUPE_SIZE - 8);
  const top = Math.max(clientY - LOUPE_SIZE - 24, 8);

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

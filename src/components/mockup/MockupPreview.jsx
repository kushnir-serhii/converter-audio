import { useEffect, useMemo, useRef, useState } from "react";
import { resolveOutputSize, coverTransform, applyTransform, scaleOutputSize } from "../../lib/aspectCrop.js";
import { drawWarpedImage } from "../../lib/perspective.js";

const PREVIEW_MAX_W = 900;
const MIME = { webp: "image/webp", png: "image/png" };

/**
 * Renders the whole composite into `ctx`.
 *
 * `viewScale` resizes the result: below 1 for the on-screen preview, above 1
 * for a 2×/3× export. It is folded into the transforms here rather than
 * applied with an outer `ctx.scale()`, because the warp writes pixels directly
 * and sets the matrix with `setTransform`, which *replaces* the canvas matrix
 * rather than multiplying into it — an outer scale would be silently ignored
 * by the warped layer, leaving the two layers disagreeing about size.
 */
function renderComposite(
  ctx,
  outputW,
  outputH,
  { scene, layers, focus, viewScale = 1, sharpen = 0.6 }
) {
  const s = viewScale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, outputW * s, outputH * s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const t = coverTransform(scene.w, scene.h, outputW, outputH, focus);
  ctx.setTransform(t.scale * s, 0, 0, t.scale * s, t.offsetX * s, t.offsetY * s);
  ctx.drawImage(scene.img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Each screen is its own screenshot + quad + fit/notch/backing/corner
  // settings, drawn in order — later layers composite on top of earlier ones.
  for (const layer of layers || []) {
    if (!layer.content || !layer.quad) continue;
    const projectedQuad = layer.quad.map(([x, y]) => {
      const [px, py] = applyTransform(t, x, y);
      return [px * s, py * s];
    });
    drawWarpedImage(ctx, layer.content.img, projectedQuad, {
      sharpen,
      fit: layer.fit,
      notch: layer.notch,
      backing: layer.backing,
      cornerRadius: layer.cornerRadius,
    });
  }
}

function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MockupPreview({
  scene,
  layers = [],
  focus,
  presetId,
  customW,
  customH,
  format,
  onFormatChange,
  exportScale = 1,
  sharpen = 0.6,
}) {
  const canvasRef = useRef(null);
  const [sizeError, setSizeError] = useState("");
  const [exporting, setExporting] = useState(false);

  const outputSize = useMemo(() => {
    try {
      setSizeError("");
      return resolveOutputSize(presetId, customW, customH);
    } catch (err) {
      setSizeError(err.message);
      return null;
    }
  }, [presetId, customW, customH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene || !outputSize) return;

    const previewScale = Math.min(1, PREVIEW_MAX_W / outputSize.w);
    canvas.width = Math.round(outputSize.w * previewScale);
    canvas.height = Math.round(outputSize.h * previewScale);
    const ctx = canvas.getContext("2d");
    renderComposite(ctx, outputSize.w, outputSize.h, {
      scene,
      layers,
      focus,
      viewScale: previewScale,
      sharpen,
    });
  }, [scene, layers, focus, outputSize, sharpen]);

  const handleExport = () => {
    if (!scene || !outputSize) return;
    setExporting(true);
    // Defer a tick so the "Exporting…" state paints before the (synchronous) full-res render.
    setTimeout(() => {
      try {
        const exportSize = scaleOutputSize(outputSize, exportScale);
        const off = document.createElement("canvas");
        off.width = exportSize.w;
        off.height = exportSize.h;
        const ctx = off.getContext("2d");
        // The quad lives in 1x output space, so the whole composite is scaled
        // up by the same viewScale mechanism the preview uses to scale down.
        renderComposite(ctx, outputSize.w, outputSize.h, {
          scene,
          layers,
          focus,
          viewScale: exportScale,
          sharpen,
        });
        off.toBlob(
          (blob) => {
            if (blob) triggerDownload(`mockup-${exportSize.w}x${exportSize.h}.${format}`, blob);
            setExporting(false);
          },
          MIME[format] || "image/webp",
          0.92
        );
      } catch {
        setExporting(false);
      }
    }, 20);
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700">Preview</p>
        {outputSize && (
          <span className="text-xs text-zinc-400 font-mono">
            {scaleOutputSize(outputSize, exportScale).w} ×{" "}
            {scaleOutputSize(outputSize, exportScale).h}
            {exportScale !== 1 && <span className="ml-1 text-zinc-300">({exportScale}×)</span>}
          </span>
        )}
      </div>

      {sizeError ? (
        <p className="text-sm text-rose-600">{sizeError}</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>
      )}

      {!layers.some((l) => l.content) && (
        <p className="text-xs text-zinc-400">Load a screenshot above to see it composited in.</p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {["webp", "png"].map((f) => (
            <button
              key={f}
              onClick={() => onFormatChange(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                format === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={!scene || !layers.some((l) => l.content && l.quad) || !outputSize || exporting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Export image"}
        </button>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import { defaultQuad } from "../lib/perspective.js";
import { ASPECT_PRESETS } from "../lib/aspectCrop.js";
import { DEFAULT_NOTCH, DEFAULT_CORNER_RADIUS } from "../lib/screen.js";

const SESSION_KEY = "mockup.session";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(partial) {
  try {
    const next = { ...loadSession(), ...partial };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable (private mode, quota) — persistence is a nicety, not required
  }
}

/** A short, stable-ish key for "this scene photo" so layers can be remembered per-photo. */
function sceneKey(file) {
  if (!file) return null;
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Couldn't load "${file.name}" as an image.`));
    };
    img.src = url;
  });
}

let layerSeq = 0;
function newLayerId() {
  layerSeq += 1;
  return `layer-${layerSeq}`;
}

/** A screen: one screenshot warped into one quad on the scene, with its own screen settings. */
function freshLayer(quad, overrides = {}) {
  return {
    id: newLayerId(),
    content: null, // { img, url, w, h } — never persisted, re-upload each session like before
    quad,
    fit: "width",
    notch: { ...DEFAULT_NOTCH },
    backing: null,
    cornerRadius: DEFAULT_CORNER_RADIUS,
    ...overrides,
  };
}

/**
 * Default corners for the Nth screen added to a scene (0-based). The first
 * screen gets the classic centered inset rect. Every screen after that would
 * otherwise start at that exact same rect — which looks, once you drop a
 * screenshot onto it, exactly like "adding a second screen replaced the
 * first": the new one is drawn on top and completely covers it. Cascading
 * later screens across different quadrants of the photo makes them visible
 * (and separately draggable onto the right device) the moment they're added.
 */
function defaultQuadForIndex(w, h, index) {
  if (index <= 0) return defaultQuad(w, h);
  const slots = [
    [0.06, 0.22, 0.46, 0.78], // left half
    [0.54, 0.22, 0.94, 0.78], // right half
    [0.22, 0.06, 0.78, 0.46], // top half
    [0.22, 0.54, 0.78, 0.94], // bottom half
  ];
  const [x0, y0, x1, y1] = slots[(index - 1) % slots.length];
  return [
    [x0 * w, y0 * h],
    [x1 * w, y0 * h],
    [x1 * w, y1 * h],
    [x0 * w, y1 * h],
  ];
}

/** Restores the layers remembered for this scene photo, or starts fresh with one. */
function restoreLayers(key, w, h) {
  const saved = loadSession();
  const savedLayers = saved.layersByScene?.[key];
  if (Array.isArray(savedLayers) && savedLayers.length > 0) {
    return savedLayers.map((l) =>
      freshLayer(l.quad && l.quad.length === 4 ? l.quad : defaultQuad(w, h), {
        fit: l.fit || "width",
        notch: { ...DEFAULT_NOTCH, ...(l.notch || {}) },
        backing: l.backing ?? null,
        cornerRadius: typeof l.cornerRadius === "number" ? l.cornerRadius : DEFAULT_CORNER_RADIUS,
      })
    );
  }
  // Legacy single-quad sessions, from before multi-layer support.
  const legacyQuad = saved.quads?.[key];
  if (Array.isArray(legacyQuad) && legacyQuad.length === 4) {
    return [freshLayer(legacyQuad)];
  }
  return [freshLayer(defaultQuad(w, h))];
}

export function useMockup() {
  const [scene, setScene] = useState(null); // { img, url, key, w, h }
  const [layers, setLayers] = useState(() => [freshLayer(null)]);
  const [activeLayerId, setActiveLayerId] = useState(() => layers[0].id);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [presetId, setPresetId] = useState(() => loadSession().lastPresetId || "portfolio");
  const [customW, setCustomW] = useState(() => loadSession().lastCustomW || 800);
  const [customH, setCustomH] = useState(() => loadSession().lastCustomH || 600);
  const [format, setFormat] = useState("webp");
  const [exportScale, setExportScaleState] = useState(() => loadSession().lastExportScale || 2);
  const [sharpen, setSharpenState] = useState(() => {
    const v = loadSession().lastSharpen;
    return typeof v === "number" ? v : 0.6;
  });
  const [error, setError] = useState("");

  const persistLayers = useCallback((nextLayers, sceneObj) => {
    if (!sceneObj?.key) return;
    const layersByScene = { ...(loadSession().layersByScene || {}) };
    layersByScene[sceneObj.key] = nextLayers.map(({ quad, fit, notch, backing, cornerRadius }) => ({
      quad,
      fit,
      notch,
      backing,
      cornerRadius,
    }));
    saveSession({ layersByScene });
  }, []);

  const loadScene = useCallback(async (file) => {
    setError("");
    try {
      const { img, url } = await loadImage(file);
      if (scene) URL.revokeObjectURL(scene.url);
      const key = sceneKey(file);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const nextScene = { img, url, key, w, h };
      setScene(nextScene);

      const restored = restoreLayers(key, w, h);
      setLayers(restored);
      setActiveLayerId(restored[0].id);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [scene]);

  const loadContent = useCallback(async (file) => {
    setError("");
    try {
      const { img, url } = await loadImage(file);
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== activeLayerId) return l;
          if (l.content) URL.revokeObjectURL(l.content.url);
          return { ...l, content: { img, url, w: img.naturalWidth, h: img.naturalHeight } };
        })
      );
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [activeLayerId]);

  const updateLayer = useCallback((id, patch) => {
    setLayers((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      persistLayers(next, scene);
      return next;
    });
  }, [persistLayers, scene]);

  const updateQuad = useCallback((next) => updateLayer(activeLayerId, { quad: next }), [activeLayerId, updateLayer]);

  const resetQuad = useCallback(() => {
    if (!scene) return;
    updateQuad(defaultQuad(scene.w, scene.h));
  }, [scene, updateQuad]);

  const setFit = useCallback((v) => updateLayer(activeLayerId, { fit: v }), [activeLayerId, updateLayer]);
  const setNotch = useCallback((v) => updateLayer(activeLayerId, { notch: v }), [activeLayerId, updateLayer]);
  const setBacking = useCallback((v) => updateLayer(activeLayerId, { backing: v }), [activeLayerId, updateLayer]);
  const setCornerRadius = useCallback(
    (v) => updateLayer(activeLayerId, { cornerRadius: v }),
    [activeLayerId, updateLayer]
  );

  const addLayer = useCallback(() => {
    if (!scene) return;
    // Computed once, outside the setLayers updater — an updater function can
    // run more than once (React StrictMode double-invokes it in dev), and
    // freshLayer() mints a new id each call, so generating the layer inside
    // one risked setActiveLayerId disagreeing with whichever id actually
    // made it into the committed layers array.
    const layer = freshLayer(defaultQuadForIndex(scene.w, scene.h, layers.length));
    setLayers((prev) => {
      const next = [...prev, layer];
      persistLayers(next, scene);
      return next;
    });
    setActiveLayerId(layer.id);
  }, [scene, layers, persistLayers]);

  const removeLayer = useCallback((id) => {
    setLayers((prev) => {
      if (prev.length <= 1) return prev; // always keep at least one screen
      const removed = prev.find((l) => l.id === id);
      if (removed?.content) URL.revokeObjectURL(removed.content.url);
      const next = prev.filter((l) => l.id !== id);
      persistLayers(next, scene);
      setActiveLayerId((cur) => (cur === id ? next[0].id : cur));
      return next;
    });
  }, [persistLayers, scene]);

  const setPreset = useCallback((id) => {
    setPresetId(id);
    saveSession({ lastPresetId: id });
  }, []);

  const setCustomSize = useCallback((w, h) => {
    setCustomW(w);
    setCustomH(h);
    saveSession({ lastCustomW: w, lastCustomH: h });
  }, []);

  const setExportScale = useCallback((v) => {
    setExportScaleState(v);
    saveSession({ lastExportScale: v });
  }, []);

  const setSharpen = useCallback((v) => {
    setSharpenState(v);
    saveSession({ lastSharpen: v });
  }, []);

  const reset = useCallback(() => {
    if (scene) URL.revokeObjectURL(scene.url);
    layers.forEach((l) => l.content && URL.revokeObjectURL(l.content.url));
    setScene(null);
    const layer = freshLayer(null);
    setLayers([layer]);
    setActiveLayerId(layer.id);
    setFocus({ x: 0.5, y: 0.5 });
    setError("");
  }, [scene, layers]);

  const presets = useMemo(() => ASPECT_PRESETS, []);
  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  return {
    scene,
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    removeLayer,
    // Convenience: the active layer's own fields, so single-screen UI (corner
    // picker, screen panel, screenshot upload) can bind to "the current one"
    // without knowing layers exist.
    content: activeLayer?.content ?? null,
    quad: activeLayer?.quad ?? null,
    focus,
    setFocus,
    presetId,
    setPreset,
    customW,
    customH,
    setCustomSize,
    format,
    setFormat,
    exportScale,
    setExportScale,
    fit: activeLayer?.fit ?? "width",
    setFit,
    notch: activeLayer?.notch ?? { ...DEFAULT_NOTCH },
    setNotch,
    backing: activeLayer?.backing ?? null,
    setBacking,
    cornerRadius: activeLayer?.cornerRadius ?? DEFAULT_CORNER_RADIUS,
    setCornerRadius,
    sharpen,
    setSharpen,
    presets,
    error,
    setError,
    loadScene,
    loadContent,
    updateQuad,
    resetQuad,
    reset,
  };
}

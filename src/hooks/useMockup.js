import { useCallback, useMemo, useState } from "react";
import { defaultQuad } from "../lib/perspective.js";
import { ASPECT_PRESETS } from "../lib/aspectCrop.js";

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

/** A short, stable-ish key for "this scene photo" so corners can be remembered per-photo. */
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

export function useMockup() {
  const [scene, setScene] = useState(null); // { img, url, key, w, h }
  const [content, setContent] = useState(null); // { img, url, w, h }
  const [quad, setQuad] = useState(null); // [[x,y] x4] in scene natural pixels, TL TR BR BL
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

  const loadScene = useCallback(async (file) => {
    setError("");
    try {
      const { img, url } = await loadImage(file);
      if (scene) URL.revokeObjectURL(scene.url);
      const key = sceneKey(file);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setScene({ img, url, key, w, h });

      const remembered = loadSession().quads?.[key];
      setQuad(remembered && remembered.length === 4 ? remembered : defaultQuad(w, h));
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [scene]);

  const loadContent = useCallback(async (file) => {
    setError("");
    try {
      const { img, url } = await loadImage(file);
      setContent((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { img, url, w: img.naturalWidth, h: img.naturalHeight };
      });
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  const updateQuad = useCallback((next) => {
    setQuad(next);
    setScene((s) => {
      if (s?.key) {
        const quads = { ...(loadSession().quads || {}), [s.key]: next };
        saveSession({ quads });
      }
      return s;
    });
  }, []);

  const resetQuad = useCallback(() => {
    if (!scene) return;
    updateQuad(defaultQuad(scene.w, scene.h));
  }, [scene, updateQuad]);

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
    if (content) URL.revokeObjectURL(content.url);
    setScene(null);
    setContent(null);
    setQuad(null);
    setFocus({ x: 0.5, y: 0.5 });
    setError("");
  }, [scene, content]);

  const presets = useMemo(() => ASPECT_PRESETS, []);

  return {
    scene,
    content,
    quad,
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

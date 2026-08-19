import { z } from "zod";

// Mirrors ALMA's src/api/mediaCatalog.ts rawCatalogEntrySchema — kept lax on
// load (only `en` required) so any catalog.json ALMA itself accepts can be
// loaded here too, even if this tool's own "add track" form is stricter.
export const CATEGORIES = ["master", "nature", "frequency", "chimes"];

export const SOUND_EXTENSIONS = ["m4a"];
export const IMAGE_EXTENSIONS = ["webp", "png", "jpg"];

// `^[a-z0-9-]+_v\d+\.(m4a|webp|png|jpg)$` — §4
export const VERSIONED_FILENAME_RE = /^[a-z0-9-]+_v\d+\.(m4a|webp|png|jpg)$/;

const almaLocalizedTextSchema = z.object({
  en: z.string().min(1).max(200),
  es: z.string().max(200).optional(),
  uk: z.string().max(200).optional(),
});

const catalogEntrySchema = z.object({
  id: z.string().min(1).max(120),
  category: z.enum(CATEGORIES),
  titles: almaLocalizedTextSchema,
  styleLabels: almaLocalizedTextSchema.optional(),
  descriptions: almaLocalizedTextSchema.optional(),
  // Kept only for pass-through fidelity on entries we don't touch; this tool
  // never writes it (see §1/§7 — dropped from the ALMA-side schema too).
  gradientKey: z.string().max(40).optional(),
  isPro: z.boolean().optional().default(true),
  sound: z.string().min(1).max(300),
  image: z.string().max(300).optional(),
  order: z.number().optional().default(0),
});

const catalogFileSchema = z.object({
  version: z.number(),
  tracks: z.array(z.unknown()),
});

/**
 * Parses & validates a raw catalog.json payload. Invalid entries are skipped
 * individually (not a hard failure) — matches ALMA's own fetchCatalog()
 * behavior so this tool never rejects a catalog the app itself tolerates.
 */
export function parseCatalog(json) {
  const file = catalogFileSchema.parse(json);
  const tracks = [];
  const invalid = [];
  file.tracks.forEach((raw, index) => {
    const result = catalogEntrySchema.safeParse(raw);
    if (!result.success) {
      invalid.push({ index, issues: result.error.issues });
      return;
    }
    tracks.push(result.data);
  });
  return { version: file.version, tracks, invalid };
}

export function slugify(input) {
  const noExt = input.replace(/\.[^./]+$/, "");
  const noVersion = noExt.replace(/_v\d+$/i, "");
  return noVersion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function dirname(key) {
  const idx = key.lastIndexOf("/");
  return idx === -1 ? "" : key.slice(0, idx + 1);
}

function extname(key) {
  const idx = key.lastIndexOf(".");
  return idx === -1 ? "" : key.slice(idx + 1).toLowerCase();
}

/** Built-in fallback used only when the loaded catalog has no entries yet for the category. */
export function defaultSoundFolder(category) {
  return `sounds/${category}/`;
}
export const DEFAULT_IMAGE_FOLDER = "images/";

/**
 * Folder for new sound/image objects, derived from existing entries of the
 * same category (falls back to a built-in map when the category is empty).
 */
export function folderForCategory(tracks, category, kind) {
  const inCategory = tracks.filter((t) => t.category === category);
  const key = kind === "sound" ? "sound" : "image";
  for (const t of inCategory) {
    if (t[key]) return dirname(t[key]);
  }
  if (kind === "image") {
    // Images aren't necessarily filed per-category in existing catalogs
    // (ALMA's template keeps them flat under images/) — fall back to any
    // existing image entry before the built-in default.
    for (const t of tracks) {
      if (t.image) return dirname(t.image);
    }
    return DEFAULT_IMAGE_FOLDER;
  }
  return defaultSoundFolder(category);
}

export function nextOrderForCategory(tracks, category) {
  const inCategory = tracks.filter((t) => t.category === category);
  if (inCategory.length === 0) return 1;
  return Math.max(...inCategory.map((t) => t.order ?? 0)) + 1;
}

export function defaultIsPro(category) {
  return category === "master";
}

export function categoryUsesStyleLabels(tracks, category) {
  return tracks.some((t) => t.category === category && t.styleLabels);
}

export function versionedBasename(mainName, version, ext) {
  return `${mainName}_v${version}.${ext.replace(/^\./, "")}`;
}

export function buildSoundKey(tracks, category, mainName, version) {
  return folderForCategory(tracks, category, "sound") + versionedBasename(mainName, version, "m4a");
}

export function buildImageKey(tracks, category, imageName, version, ext) {
  return folderForCategory(tracks, category, "image") + versionedBasename(imageName, version, ext);
}

/** For "Link by name" images: category's image folder + the picked filename, verbatim, no _vN. */
export function linkedImageKey(tracks, category, filename) {
  return folderForCategory(tracks, category, "image") + filename;
}

export function backupFilename(oldVersion) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `catalog.backup.v${oldVersion}.${ts}.json`;
}

/**
 * Applies an add or replace to a tracks array, returning a *new* array
 * (immutable) with the given entry inserted/updated. `id` presence in the
 * existing array decides add vs replace.
 */
export function upsertTrack(tracks, entry) {
  const idx = tracks.findIndex((t) => t.id === entry.id);
  if (idx === -1) return [...tracks, entry];
  const next = tracks.slice();
  next[idx] = entry;
  return next;
}

/**
 * Diff between the loaded catalog's tracks and the working copy. `added` and
 * `changed` compare by id; `changed` entries include both versions.
 */
export function diffCatalog(originalTracks, workingTracks) {
  const originalById = new Map(originalTracks.map((t) => [t.id, t]));
  const added = [];
  const changed = [];
  const unchanged = [];

  for (const track of workingTracks) {
    const before = originalById.get(track.id);
    if (!before) {
      added.push(track);
    } else if (JSON.stringify(before) !== JSON.stringify(track)) {
      changed.push({ id: track.id, before, after: track });
    } else {
      unchanged.push(track);
    }
  }

  return { added, changed, unchanged };
}

/**
 * Validation run before the diff screen (§4). `uploadKeys` is the Set of
 * object keys actually queued for upload this session; `linkedKeys` is the
 * Set of image keys entered via "Link by name" (exempt from the upload-set
 * and _vN filename checks, but flagged as unverifiable).
 */
export function validateCatalogUpdate({
  originalTracks,
  workingTracks,
  newVersion,
  oldVersion,
  uploadKeys = new Set(),
  linkedKeys = new Set(),
}) {
  const errors = [];
  const warnings = [];

  const ids = new Set();
  for (const t of workingTracks) {
    if (ids.has(t.id)) errors.push(`Duplicate id "${t.id}"`);
    ids.add(t.id);
  }

  for (const category of CATEGORIES) {
    const orders = new Map();
    for (const t of workingTracks.filter((t) => t.category === category)) {
      if (orders.has(t.order)) {
        errors.push(`Duplicate order ${t.order} in category "${category}" (${orders.get(t.order)}, ${t.id})`);
      }
      orders.set(t.order, t.id);
    }
  }

  if (!(newVersion > oldVersion)) {
    errors.push(`New version (${newVersion}) must be greater than the loaded version (${oldVersion})`);
  }

  const { added, changed } = diffCatalog(originalTracks, workingTracks);
  const touched = [...added, ...changed.map((c) => c.after)];

  for (const track of touched) {
    for (const key of [track.sound, track.image].filter(Boolean)) {
      if (linkedKeys.has(key)) {
        warnings.push(`"${key}" is linked by name — it cannot be verified from the browser.`);
        continue;
      }
      if (!uploadKeys.has(key)) {
        errors.push(`"${key}" is referenced by "${track.id}" but is not in the upload set.`);
        continue;
      }
      if (!VERSIONED_FILENAME_RE.test(key.slice(key.lastIndexOf("/") + 1))) {
        errors.push(`"${key}" doesn't match the required _vN filename pattern.`);
      }
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}

export function isAcceptedSoundFile(filename) {
  return SOUND_EXTENSIONS.includes(extname(filename));
}

export function isAcceptedImageFile(filename) {
  return IMAGE_EXTENSIONS.includes(extname(filename));
}

/** Serializes the catalog for upload — gradientKey is never written (§1/§7). */
export function toCatalogJson(version, tracks) {
  return {
    version,
    tracks: tracks.map(({ gradientKey, ...rest }) => rest),
  };
}

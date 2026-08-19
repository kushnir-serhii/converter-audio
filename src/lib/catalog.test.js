import { describe, it, expect } from "vitest";
import {
  parseCatalog,
  slugify,
  folderForCategory,
  nextOrderForCategory,
  defaultIsPro,
  versionedBasename,
  buildSoundKey,
  buildImageKey,
  linkedImageKey,
  upsertTrack,
  diffCatalog,
  validateCatalogUpdate,
  backupFilename,
  isAcceptedSoundFile,
  isAcceptedImageFile,
  toCatalogJson,
  VERSIONED_FILENAME_RE,
} from "./catalog.js";

const sampleCatalog = {
  version: 2,
  tracks: [
    {
      id: "calming-rain",
      category: "nature",
      titles: { en: "Calming Rain", es: "Lluvia Relajante", uk: "Заспокійливий дощ" },
      descriptions: { en: "Soft rain" },
      isPro: false,
      sound: "sounds/nature/calming-rain.m4a",
      order: 1,
    },
    {
      id: "arabian-sufi",
      category: "master",
      titles: { en: "Desert Soul" },
      gradientKey: "dust",
      isPro: false,
      sound: "sounds/master/desert-soul.m4a",
      image: "images/dust.webp",
      order: 1,
    },
    // invalid: missing sound
    { id: "broken", category: "master", titles: { en: "Broken" } },
  ],
};

describe("parseCatalog", () => {
  it("parses valid entries and skips invalid ones individually", () => {
    const { version, tracks, invalid } = parseCatalog(sampleCatalog);
    expect(version).toBe(2);
    expect(tracks).toHaveLength(2);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].index).toBe(2);
  });

  it("keeps gradientKey pass-through for entries that have it", () => {
    const { tracks } = parseCatalog(sampleCatalog);
    const track = tracks.find((t) => t.id === "arabian-sufi");
    expect(track.gradientKey).toBe("dust");
  });

  it("defaults isPro to true and order to 0 when absent", () => {
    const { tracks } = parseCatalog({
      version: 1,
      tracks: [{ id: "x", category: "chimes", titles: { en: "X" }, sound: "sounds/chimes/x.m4a" }],
    });
    expect(tracks[0].isPro).toBe(true);
    expect(tracks[0].order).toBe(0);
  });
});

describe("slugify", () => {
  it("kebab-cases and strips extension / _vN suffix", () => {
    expect(slugify("Calming Rain_v3.wav")).toBe("calming-rain");
    expect(slugify("My  Cool   Track.mp3")).toBe("my-cool-track");
    expect(slugify("Already-kebab.m4a")).toBe("already-kebab");
  });
});

describe("folderForCategory", () => {
  const { tracks } = parseCatalog(sampleCatalog);

  it("derives the sound folder from existing entries in the category", () => {
    expect(folderForCategory(tracks, "nature", "sound")).toBe("sounds/nature/");
  });

  it("falls back to the built-in map for an empty category", () => {
    expect(folderForCategory(tracks, "frequency", "sound")).toBe("sounds/frequency/");
  });

  it("derives the image folder from any existing image entry", () => {
    expect(folderForCategory(tracks, "nature", "image")).toBe("images/");
  });

  it("falls back to images/ when no image entries exist at all", () => {
    expect(folderForCategory([], "master", "image")).toBe("images/");
  });
});

describe("nextOrderForCategory / defaultIsPro", () => {
  const { tracks } = parseCatalog(sampleCatalog);

  it("returns max(order)+1 within the category", () => {
    expect(nextOrderForCategory(tracks, "nature")).toBe(2);
  });

  it("returns 1 for an empty category", () => {
    expect(nextOrderForCategory(tracks, "chimes")).toBe(1);
  });

  it("defaults isPro true only for master", () => {
    expect(defaultIsPro("master")).toBe(true);
    expect(defaultIsPro("nature")).toBe(false);
    expect(defaultIsPro("chimes")).toBe(false);
  });
});

describe("filename / key builders", () => {
  const { tracks } = parseCatalog(sampleCatalog);

  it("builds a _vN versioned basename", () => {
    expect(versionedBasename("forest-rain", 5, "m4a")).toBe("forest-rain_v5.m4a");
    expect(versionedBasename("forest-rain", 5, ".webp")).toBe("forest-rain_v5.webp");
  });

  it("builds a sound key under the category folder", () => {
    expect(buildSoundKey(tracks, "nature", "forest-rain", 5)).toBe("sounds/nature/forest-rain_v5.m4a");
  });

  it("builds an image key under the derived image folder", () => {
    expect(buildImageKey(tracks, "nature", "forest-rain", 5, "webp")).toBe("images/forest-rain_v5.webp");
  });

  it("links an image by name verbatim, no _vN", () => {
    expect(linkedImageKey(tracks, "master", "existing-art.webp")).toBe("images/existing-art.webp");
  });

  it("matches the required filename pattern", () => {
    expect(VERSIONED_FILENAME_RE.test("forest-rain_v5.m4a")).toBe(true);
    expect(VERSIONED_FILENAME_RE.test("forest-rain.m4a")).toBe(false);
    expect(VERSIONED_FILENAME_RE.test("Forest_v5.m4a")).toBe(false);
  });
});

describe("upsertTrack / diffCatalog", () => {
  const { tracks } = parseCatalog(sampleCatalog);

  it("adds a new track by id", () => {
    const next = upsertTrack(tracks, {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one_v3.m4a",
      order: 1,
    });
    expect(next).toHaveLength(3);
    expect(tracks).toHaveLength(2); // immutable
  });

  it("replaces an existing track by id in place", () => {
    const replaced = { ...tracks[0], order: 9 };
    const next = upsertTrack(tracks, replaced);
    expect(next).toHaveLength(2);
    expect(next[0].order).toBe(9);
  });

  it("diffs added / changed / unchanged", () => {
    const working = upsertTrack(tracks, { ...tracks[0], order: 9 });
    const withAdd = upsertTrack(working, {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one_v3.m4a",
      order: 1,
    });
    const diff = diffCatalog(tracks, withAdd);
    expect(diff.added).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.changed[0].id).toBe("calming-rain");
  });
});

describe("validateCatalogUpdate", () => {
  const { tracks } = parseCatalog(sampleCatalog);

  it("passes for a valid add with the new key in the upload set", () => {
    const newTrack = {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one_v3.m4a",
      order: 1,
    };
    const working = upsertTrack(tracks, newTrack);
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
      uploadKeys: new Set([newTrack.sound]),
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags duplicate ids", () => {
    const working = [...tracks, { ...tracks[0] }];
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate id"))).toBe(true);
  });

  it("flags duplicate order within a category", () => {
    const dup = { ...tracks[1], id: "dup", order: tracks[1].order };
    const working = upsertTrack(tracks, dup);
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
    });
    expect(result.errors.some((e) => e.includes("Duplicate order"))).toBe(true);
  });

  it("requires the new version to be greater than the old one", () => {
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: tracks,
      newVersion: 2,
      oldVersion: 2,
    });
    expect(result.errors.some((e) => e.includes("must be greater"))).toBe(true);
  });

  it("errors when a touched entry's key is missing from the upload set", () => {
    const newTrack = {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one_v3.m4a",
      order: 1,
    };
    const working = upsertTrack(tracks, newTrack);
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
      uploadKeys: new Set(),
    });
    expect(result.errors.some((e) => e.includes("not in the upload set"))).toBe(true);
  });

  it("warns (not errors) for linked-by-name image keys", () => {
    const newTrack = {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one_v3.m4a",
      image: "images/existing-art.webp",
      order: 1,
    };
    const working = upsertTrack(tracks, newTrack);
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
      uploadKeys: new Set([newTrack.sound]),
      linkedKeys: new Set(["images/existing-art.webp"]),
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("linked by name"))).toBe(true);
  });

  it("rejects a touched key that doesn't match the _vN filename pattern", () => {
    const newTrack = {
      id: "new-one",
      category: "chimes",
      titles: { en: "New", es: "Nuevo", uk: "Новий" },
      isPro: false,
      sound: "sounds/chimes/new-one.m4a",
      order: 1,
    };
    const working = upsertTrack(tracks, newTrack);
    const result = validateCatalogUpdate({
      originalTracks: tracks,
      workingTracks: working,
      newVersion: 3,
      oldVersion: 2,
      uploadKeys: new Set([newTrack.sound]),
    });
    expect(result.errors.some((e) => e.includes("_vN filename pattern"))).toBe(true);
  });
});

describe("backupFilename / isAcceptedSoundFile", () => {
  it("names the backup with the old version and a timestamp", () => {
    const name = backupFilename(4);
    expect(name).toMatch(/^catalog\.backup\.v4\.[\d-TZ]+\.json$/);
  });

  it("only accepts m4a as a catalog-ready sound file", () => {
    expect(isAcceptedSoundFile("track.m4a")).toBe(true);
    expect(isAcceptedSoundFile("track.wav")).toBe(false);
    expect(isAcceptedSoundFile("track.mp3")).toBe(false);
  });

  it("accepts webp/png/jpg as image files", () => {
    expect(isAcceptedImageFile("cover.webp")).toBe(true);
    expect(isAcceptedImageFile("cover.png")).toBe(true);
    expect(isAcceptedImageFile("cover.jpg")).toBe(true);
    expect(isAcceptedImageFile("cover.gif")).toBe(false);
  });
});

describe("toCatalogJson", () => {
  it("strips gradientKey from every entry", () => {
    const { tracks } = parseCatalog(sampleCatalog);
    const json = toCatalogJson(3, tracks);
    expect(json.version).toBe(3);
    expect(json.tracks.every((t) => !("gradientKey" in t))).toBe(true);
  });
});

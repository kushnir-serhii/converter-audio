import { useCallback, useEffect, useState } from "react";
import {
  parseCatalog,
  upsertTrack,
  diffCatalog,
  validateCatalogUpdate,
  backupFilename,
  toCatalogJson,
} from "../lib/catalog.js";
import {
  loadR2Credentials,
  saveR2Credentials,
  hasR2Credentials,
  getJson,
  putObject,
  uploadAll,
  downloadLocally,
  contentTypeFor,
} from "../lib/r2.js";

const SESSION_KEY = "catalog.session";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(partial) {
  const next = { ...loadSession(), ...partial };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export function useCatalog() {
  const [credentials, setCredentialsState] = useState(
    () => loadR2Credentials() ?? { accountId: "", accessKeyId: "", secretAccessKey: "", bucket: "" }
  );
  const [source, setSource] = useState(null); // { raw, oldVersion, originalTracks, invalid }
  const [workingTracks, setWorkingTracks] = useState([]);
  const [category, setCategory] = useState(() => loadSession().lastCategory || "master");
  const [version, setVersion] = useState(null);
  const [pendingUploads, setPendingUploads] = useState(new Map());
  const [linkedKeys, setLinkedKeys] = useState(new Set());
  const [step, setStep] = useState("load");
  const [uploadStatus, setUploadStatus] = useState({});
  const [error, setError] = useState("");

  const setCredentials = useCallback((creds) => {
    setCredentialsState(creds);
    saveR2Credentials(creds);
  }, []);

  useEffect(() => {
    saveSession({ lastCategory: category });
  }, [category]);

  const loadFromData = useCallback((json) => {
    const { version: oldVersion, tracks, invalid } = parseCatalog(json);
    setSource({ raw: json, oldVersion, originalTracks: tracks, invalid });
    setWorkingTracks(tracks);
    // Resume a remembered session version if it's still valid (> oldVersion),
    // otherwise the usual default of oldVersion + 1 — see §5.2.
    const remembered = loadSession().lastVersion;
    const initialVersion = Number.isFinite(remembered) && remembered > oldVersion ? remembered : oldVersion + 1;
    setVersion(initialVersion);
    setPendingUploads(new Map());
    setLinkedKeys(new Set());
    setStep("work");
    saveSession({ lastVersion: initialVersion });
  }, []);

  const loadFromR2 = useCallback(async () => {
    setError("");
    try {
      const json = await getJson(credentials, "catalog.json");
      if (!json) throw new Error("catalog.json not found in the bucket.");
      loadFromData(json);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [credentials, loadFromData]);

  const importFile = useCallback(
    async (file) => {
      setError("");
      try {
        const text = await file.text();
        loadFromData(JSON.parse(text));
      } catch (err) {
        setError("Couldn't parse that file as JSON: " + (err.message || err));
      }
    },
    [loadFromData]
  );

  const addOrReplaceTrack = useCallback((entry, uploadItems, newLinkedKeys) => {
    setWorkingTracks((prev) => upsertTrack(prev, entry));
    setPendingUploads((prev) => {
      const next = new Map(prev);
      for (const item of uploadItems) next.set(item.key, item);
      return next;
    });
    if (newLinkedKeys && newLinkedKeys.length) {
      setLinkedKeys((prev) => new Set([...prev, ...newLinkedKeys]));
    }
  }, []);

  const setSessionVersion = useCallback((v) => {
    setVersion(v);
    saveSession({ lastVersion: v });
  }, []);

  const validation = source
    ? validateCatalogUpdate({
        originalTracks: source.originalTracks,
        workingTracks,
        newVersion: version,
        oldVersion: source.oldVersion,
        uploadKeys: new Set(pendingUploads.keys()),
        linkedKeys,
      })
    : { errors: [], warnings: [], valid: false };

  const diff = source ? diffCatalog(source.originalTracks, workingTracks) : { added: [], changed: [], unchanged: [] };

  const goToDiff = useCallback(() => setStep("diff"), []);
  const backToWork = useCallback(() => setStep("work"), []);

  const confirmUpload = useCallback(async () => {
    if (!source) return;
    setStep("uploading");
    setUploadStatus({});
    setError("");

    const backupName = backupFilename(source.oldVersion);
    const backupText = JSON.stringify(source.raw, null, 2);
    const catalogText = JSON.stringify(toCatalogJson(version, workingTracks), null, 2);

    try {
      // Local backup download always happens first, regardless of upload path.
      downloadLocally(backupName, backupText);

      if (hasR2Credentials(credentials)) {
        setUploadStatus((s) => ({ ...s, [backupName]: "uploading" }));
        await putObject(credentials, backupName, backupText, "application/json");
        setUploadStatus((s) => ({ ...s, [backupName]: "done" }));

        await uploadAll(credentials, [...pendingUploads.values()], (key, status, err) => {
          setUploadStatus((s) => ({ ...s, [key]: err ? "error" : status }));
          if (err) throw err;
        });

        setUploadStatus((s) => ({ ...s, "catalog.json": "uploading" }));
        await putObject(credentials, "catalog.json", catalogText, "application/json");
        setUploadStatus((s) => ({ ...s, "catalog.json": "done" }));
      } else {
        for (const item of pendingUploads.values()) {
          downloadLocally(item.key.split("/").pop(), item.body);
          setUploadStatus((s) => ({ ...s, [item.key]: "done" }));
        }
        downloadLocally("catalog.json", catalogText);
        setUploadStatus((s) => ({ ...s, "catalog.json": "done" }));
      }
      setStep("done");
    } catch (err) {
      setError(err.message || String(err));
      setStep("diff");
    }
  }, [credentials, pendingUploads, source, version, workingTracks]);

  const reset = useCallback(() => {
    setSource(null);
    setWorkingTracks([]);
    setVersion(null);
    setPendingUploads(new Map());
    setLinkedKeys(new Set());
    setStep("load");
    setUploadStatus({});
    setError("");
  }, []);

  return {
    credentials,
    setCredentials,
    hasCredentials: hasR2Credentials(credentials),
    source,
    workingTracks,
    category,
    setCategory,
    version,
    setSessionVersion,
    step,
    setStep,
    error,
    setError,
    loadFromR2,
    importFile,
    addOrReplaceTrack,
    diff,
    validation,
    goToDiff,
    backToWork,
    confirmUpload,
    uploadStatus,
    reset,
    pendingUploads,
    contentTypeFor,
  };
}

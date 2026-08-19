import { useEffect, useState } from "react";
import { checkAudio, applyAudioFix } from "../../lib/audioCheck.js";

/**
 * §5.1 — runs the astats/loudness check on `file` for `category` and offers
 * "Fix" or "Keep as is" per finding. Never blocks: onDone always fires with
 * the (possibly fixed) file.
 */
export default function AudioCheckDialog({ file, category, onDone, onSkip }) {
  const [state, setState] = useState("checking"); // checking | findings | fixing | clean | error
  const [findings, setFindings] = useState([]);
  const [currentFile, setCurrentFile] = useState(file);
  const [errorMsg, setErrorMsg] = useState("");

  const runCheck = async (f) => {
    setState("checking");
    try {
      const result = await checkAudio(f, category);
      setFindings(result.findings);
      setState(result.findings.length > 0 ? "findings" : "clean");
    } catch (err) {
      setErrorMsg(err.message || String(err));
      setState("error");
    }
  };

  useEffect(() => {
    runCheck(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const handleFix = async () => {
    setState("fixing");
    try {
      const fixedBlob = await applyAudioFix(currentFile, category);
      const fixedFile = new File([fixedBlob], currentFile.name, { type: fixedBlob.type });
      setCurrentFile(fixedFile);
      await runCheck(fixedFile);
    } catch (err) {
      setErrorMsg(err.message || String(err));
      setState("error");
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col gap-3 text-sm">
      <p className="font-medium text-indigo-800">Audio check — {file.name}</p>

      {state === "checking" && <p className="text-indigo-600">Analyzing edges &amp; loudness…</p>}
      {state === "fixing" && <p className="text-indigo-600">Applying fix…</p>}

      {state === "clean" && (
        <>
          <p className="text-emerald-700">✓ No issues found for the "{category}" target.</p>
          <div className="flex justify-end">
            <button onClick={() => onDone(currentFile)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white font-medium hover:bg-indigo-700">
              Continue
            </button>
          </div>
        </>
      )}

      {state === "findings" && (
        <>
          <ul className="flex flex-col gap-1">
            {findings.map((f, i) => (
              <li key={i} className="text-amber-700">⚠ {f.message}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button onClick={() => onDone(currentFile)} className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-white">
              Keep as is
            </button>
            <button onClick={handleFix} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white font-medium hover:bg-indigo-700">
              Fix
            </button>
          </div>
        </>
      )}

      {state === "error" && (
        <>
          <p className="text-red-600">Couldn't analyze this file: {errorMsg}</p>
          <div className="flex justify-end">
            <button onClick={() => onDone(currentFile)} className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-white">
              Continue anyway
            </button>
          </div>
        </>
      )}

      {onSkip && state !== "checking" && state !== "fixing" && (
        <button onClick={onSkip} className="self-start text-xs text-zinc-400 hover:text-zinc-600 underline">
          Skip check
        </button>
      )}
    </div>
  );
}

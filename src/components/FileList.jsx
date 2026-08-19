import FileRow from "./FileRow.jsx";

function triggerDownload(row) {
  const a = document.createElement("a");
  a.href = row.objectUrl;
  a.download = row.outputName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function FileList({ files, onRemove, onSendToCatalog }) {
  const doneRows = files.filter((f) => f.status === "done");

  const downloadAll = async () => {
    for (const row of doneRows) {
      triggerDownload(row);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      {files.map((row) => (
        <FileRow
          key={row.id}
          row={row}
          onRemove={onRemove}
          onDownload={triggerDownload}
          onSendToCatalog={onSendToCatalog}
        />
      ))}

      {doneRows.length >= 2 && (
        <div className="pt-3 flex justify-end">
          <button
            onClick={downloadAll}
            className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Download all
          </button>
        </div>
      )}
    </div>
  );
}

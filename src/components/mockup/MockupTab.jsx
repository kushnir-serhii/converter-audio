import { useState } from "react";
import { useMockup } from "../../hooks/useMockup.js";
import ImageDropZone from "./ImageDropZone.jsx";
import CornerPicker from "./CornerPicker.jsx";
import AspectPicker from "./AspectPicker.jsx";
import ScreenPanel from "./ScreenPanel.jsx";
import Modal from "./Modal.jsx";
import MockupPreview from "./MockupPreview.jsx";

export default function MockupTab() {
  const mockup = useMockup();
  const [cornersExpanded, setCornersExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-700">1. Scene photo</p>
        <p className="text-xs text-zinc-500 -mt-1">
          A photo of a laptop, phone, or monitor with an empty screen — the screenshot below
          gets warped onto it.
        </p>
        <ImageDropZone
          label="Drag & drop a scene photo"
          hint="JPG, PNG, WebP"
          thumbnailUrl={mockup.scene?.url}
          onFile={mockup.loadScene}
        />
      </div>

      {mockup.scene && (
        <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">2. Mark the screen corners</p>
            <button
              onClick={() => setCornersExpanded(true)}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200"
            >
              Open large
            </button>
          </div>
          <CornerPicker
            image={mockup.scene.img}
            naturalW={mockup.scene.w}
            naturalH={mockup.scene.h}
            quad={mockup.quad}
            onChange={mockup.updateQuad}
            onReset={mockup.resetQuad}
          />
          <p className="text-xs text-zinc-400">
            Fiddly at this size — open it large to place the corners precisely.
          </p>
        </div>
      )}

      <Modal
        open={cornersExpanded && !!mockup.scene}
        onClose={() => setCornersExpanded(false)}
        title="Mark the screen corners"
      >
        {mockup.scene && (
          <CornerPicker
            fullscreen
            image={mockup.scene.img}
            naturalW={mockup.scene.w}
            naturalH={mockup.scene.h}
            quad={mockup.quad}
            onChange={mockup.updateQuad}
            onReset={mockup.resetQuad}
          />
        )}
      </Modal>

      {mockup.scene && (
        <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">3. Screenshot to composite</p>
          <ImageDropZone
            label="Drag & drop the content screenshot"
            hint="Whatever should appear on the screen"
            thumbnailUrl={mockup.content?.url}
            onFile={mockup.loadContent}
          />
        </div>
      )}

      {mockup.scene && (
        <>
          <ScreenPanel
            fit={mockup.fit}
            onFitChange={mockup.setFit}
            notch={mockup.notch}
            onNotchChange={mockup.setNotch}
            backing={mockup.backing}
            onBackingChange={mockup.setBacking}
            cornerRadius={mockup.cornerRadius}
            onCornerRadiusChange={mockup.setCornerRadius}
          />

          <AspectPicker
            presets={mockup.presets}
            presetId={mockup.presetId}
            onPresetChange={mockup.setPreset}
            customW={mockup.customW}
            customH={mockup.customH}
            onCustomChange={mockup.setCustomSize}
            focus={mockup.focus}
            onFocusChange={mockup.setFocus}
            exportScale={mockup.exportScale}
            onExportScaleChange={mockup.setExportScale}
            sharpen={mockup.sharpen}
            onSharpenChange={mockup.setSharpen}
          />

          <MockupPreview
            scene={mockup.scene}
            content={mockup.content}
            quad={mockup.quad}
            focus={mockup.focus}
            presetId={mockup.presetId}
            customW={mockup.customW}
            customH={mockup.customH}
            format={mockup.format}
            onFormatChange={mockup.setFormat}
            exportScale={mockup.exportScale}
            sharpen={mockup.sharpen}
            fit={mockup.fit}
            notch={mockup.notch}
            backing={mockup.backing}
            cornerRadius={mockup.cornerRadius}
          />
        </>
      )}

      {mockup.error && <p className="text-sm text-rose-600">{mockup.error}</p>}

      {mockup.scene && (
        <div className="flex justify-end">
          <button onClick={mockup.reset} className="text-xs font-medium text-zinc-400 hover:text-zinc-600">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

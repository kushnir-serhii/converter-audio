export const OUTPUT_FORMATS = [
  {
    id: "aac",
    label: "AAC (.m4a)",
    extension: ".m4a",
    mimeType: "audio/mp4",
    bitrates: [96, 128, 192, 256],
    defaultBitrate: 192,
    args: (bitrate) => ["-c:a", "aac", "-b:a", `${bitrate}k`, "-vn"],
  },
  {
    id: "mp3",
    label: "MP3",
    extension: ".mp3",
    mimeType: "audio/mpeg",
    bitrates: [96, 128, 192, 256, 320],
    defaultBitrate: 192,
    args: (bitrate) => ["-c:a", "libmp3lame", "-b:a", `${bitrate}k`, "-vn"],
  },
  {
    id: "ogg",
    label: "OGG Vorbis",
    extension: ".ogg",
    mimeType: "audio/ogg",
    bitrates: [96, 128, 192, 256],
    defaultBitrate: 192,
    args: (bitrate) => ["-c:a", "libvorbis", "-b:a", `${bitrate}k`, "-vn"],
  },
  {
    id: "wav",
    label: "WAV",
    extension: ".wav",
    mimeType: "audio/wav",
    bitrates: null,
    defaultBitrate: null,
    args: () => ["-c:a", "pcm_s16le", "-vn"],
  },
  {
    id: "flac",
    label: "FLAC",
    extension: ".flac",
    mimeType: "audio/flac",
    bitrates: null,
    defaultBitrate: null,
    args: () => ["-c:a", "flac", "-vn"],
  },
];

export const INPUT_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac"];

export function getFormat(id) {
  return OUTPUT_FORMATS.find((f) => f.id === id);
}

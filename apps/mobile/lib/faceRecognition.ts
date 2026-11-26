import {
  loadTensorflowModel,
  type TfliteModel
} from "react-native-fast-tflite";
import type { Image as NitroImage, RawPixelData } from "react-native-nitro-image";
import {
  findBestFaceMatch,
  normalizeEmbedding,
  type FaceMatch
} from "@sri-narayana/shared";
import type { FaceGalleryCandidate } from "@/lib/faceApi";

const MODEL_ASSET = require("../assets/models/mobilefacenet.tflite");
const INPUT_SIZE = 112;
const FACE_MARGIN = 1.35;

let modelPromise: Promise<TfliteModel> | null = null;

export function loadFaceModel(): Promise<TfliteModel> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(MODEL_ASSET, []).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function channelReader(pixelFormat: RawPixelData["pixelFormat"]) {
  switch (pixelFormat) {
    case "RGBA":
      return { red: 0, green: 1, blue: 2, stride: 4 };
    case "BGRA":
      return { red: 2, green: 1, blue: 0, stride: 4 };
    case "ARGB":
      return { red: 1, green: 2, blue: 3, stride: 4 };
    case "ABGR":
      return { red: 3, green: 2, blue: 1, stride: 4 };
    case "RGBX":
      return { red: 0, green: 1, blue: 2, stride: 4 };
    case "XRGB":
      return { red: 1, green: 2, blue: 3, stride: 4 };
    case "BGRX":
      return { red: 2, green: 1, blue: 0, stride: 4 };
    case "XBGR":
      return { red: 3, green: 2, blue: 1, stride: 4 };
    case "RGB":
      return { red: 0, green: 1, blue: 2, stride: 3 };
    case "BGR":
      return { red: 2, green: 1, blue: 0, stride: 3 };
    default:
      return { red: 0, green: 1, blue: 2, stride: 4 };
  }
}
function pixelsToInput(raw: RawPixelData): Float32Array {
  const values = new Uint8Array(raw.buffer);
  const reader = channelReader(raw.pixelFormat);
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  let target = 0;
  for (let index = 0; index < INPUT_SIZE * INPUT_SIZE; index += 1) {
    const source = index * reader.stride;
    input[target] = (values[source + reader.red] ?? 0) / 127.5 - 1;
    input[target + 1] = (values[source + reader.green] ?? 0) / 127.5 - 1;
    input[target + 2] = (values[source + reader.blue] ?? 0) / 127.5 - 1;
    target += 3;
  }
  return input;
}

export type FaceEmbeddingResult = {
  embedding: number[];
  quality: number;
};

export async function embedFace(
  image: NitroImage,
  bounds: { x: number; y: number; width: number; height: number }
): Promise<FaceEmbeddingResult> {
  const side = Math.max(
    INPUT_SIZE,
    Math.min(
      Math.min(image.width, image.height),
      Math.max(bounds.width, bounds.height) * FACE_MARGIN
    )
  );
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const startX = Math.max(0, Math.min(image.width - side, centerX - side / 2));
  const startY = Math.max(0, Math.min(image.height - side, centerY - side / 2));

  const cropped = await image.cropAsync(startX, startY, startX + side, startY + side);
  let resized: NitroImage | null = null;
  let input: Float32Array;
  try {
    resized = await cropped.resizeAsync(INPUT_SIZE, INPUT_SIZE);
    const raw = resized.toRawPixelData(false);
    input = pixelsToInput(raw);
  } finally {
    cropped.dispose();
    resized?.dispose();
  }
  const model = await loadFaceModel();
  const outputs = await model.run([input.buffer as ArrayBuffer]);
  const first = outputs[0];
  if (!first) throw new Error("The face model returned no result.");

  const embedding = normalizeEmbedding(Array.from(new Float32Array(first)));
  if (embedding.length < 64) throw new Error("The face model returned an invalid result.");

  return {
    embedding,
    quality: Math.max(0, Math.min(1, (side / Math.min(image.width, image.height)) * 1.8))
  };
}

export function matchFace(
  observed: readonly number[],
  candidates: readonly FaceGalleryCandidate[],
  threshold: number
): { candidate: FaceGalleryCandidate; confidence: number } | null {
  const match: FaceMatch | null = findBestFaceMatch(observed, candidates, threshold);
  if (!match) return null;
  const candidate = candidates.find((item) => item.teacherId === match.teacherId);
  return candidate ? { candidate, confidence: match.confidence } : null;
}

export type FaceCandidate = {
  teacherId: string;
  embedding: number[];
  modelVersion?: string;
};

export type FaceMatch = {
  teacherId: string;
  confidence: number;
};

/** Unit-length copy; returns an empty array for zero/NaN vectors. */
export function normalizeEmbedding(values: readonly number[]): number[] {
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return [];
    sum += value * value;
  }
  const length = Math.sqrt(sum);
  if (!Number.isFinite(length) || length === 0) return [];
  return values.map((value) => value / length);
}

/** Average several enrollment samples, then normalize the result. */
export function averageEmbeddings(samples: readonly (readonly number[])[]): number[] {
  if (samples.length === 0) return [];
  const dimensions = samples[0]?.length ?? 0;
  if (dimensions === 0 || samples.some((sample) => sample.length !== dimensions)) return [];
  const sum = new Array<number>(dimensions).fill(0);
  for (const sample of samples) {
    for (let index = 0; index < dimensions; index += 1) {
      const value = sample[index];
      if (!Number.isFinite(value)) return [];
      sum[index] += value;
    }
  }
  return normalizeEmbedding(sum.map((value) => value / samples.length));
}

/** Cosine similarity for two equal-length vectors. Returns -1 for invalid input. */
export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return -1;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return -1;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

/**
 * Best 1:N match. A result is returned only when it clears `threshold` and
 * beats the runner-up by `margin`; this prevents ambiguous faces being marked.
 */
export function findBestFaceMatch(
  observed: readonly number[],
  candidates: readonly FaceCandidate[],
  threshold: number,
  margin = 0.05
): FaceMatch | null {
  let best: FaceMatch | null = null;
  let runnerUp = -1;
  for (const candidate of candidates) {
    const confidence = cosineSimilarity(observed, candidate.embedding);
    if (!Number.isFinite(confidence) || confidence < 0) continue;
    if (!best || confidence > best.confidence) {
      runnerUp = best?.confidence ?? runnerUp;
      best = { teacherId: candidate.teacherId, confidence };
    } else if (confidence > runnerUp) {
      runnerUp = confidence;
    }
  }
  if (!best || best.confidence < threshold) return null;
  if (runnerUp >= 0 && best.confidence - runnerUp < margin) return null;
  return best;
}

export type LivenessTracker = {
  blinkSeenClosed: boolean;
  blinkPassed: boolean;
  turnedNegative: boolean;
  turnedPositive: boolean;
  turnPassed: boolean;
};

export type LivenessFaceSample = {
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  yawAngle: number;
};

export const INITIAL_LIVENESS: LivenessTracker = {
  blinkSeenClosed: false,
  blinkPassed: false,
  turnedNegative: false,
  turnedPositive: false,
  turnPassed: false
};

export function applyLivenessSample(
  current: LivenessTracker,
  face: LivenessFaceSample
): LivenessTracker {
  let next = current;
  const left = face.leftEyeOpenProbability;
  const right = face.rightEyeOpenProbability;

  if (!next.blinkPassed && typeof left === "number" && typeof right === "number") {
    const closed = Math.min(left, right) < 0.25;
    const open = Math.min(left, right) > 0.6;
    if (closed && !next.blinkSeenClosed) {
      next = { ...next, blinkSeenClosed: true };
    } else if (open && next.blinkSeenClosed) {
      next = { ...next, blinkPassed: true };
    }
  }

  if (!next.turnPassed) {
    const turned = face.yawAngle;
    if (turned < -18) next = { ...next, turnedNegative: true };
    if (turned > 18) next = { ...next, turnedPositive: true };
    if (next.turnedNegative && next.turnedPositive) {
      next = { ...next, turnPassed: true };
    }
  }

  return next;
}

export function livenessPassed(tracker: LivenessTracker): boolean {
  return tracker.blinkPassed && tracker.turnPassed;
}

export function livenessScore(tracker: LivenessTracker): number {
  return (tracker.blinkPassed ? 0.5 : 0) + (tracker.turnPassed ? 0.5 : 0);
}

export function livenessHint(tracker: LivenessTracker): string {
  if (!tracker.blinkPassed) return "Blink once, slowly.";
  if (!tracker.turnPassed) {
    if (!tracker.turnedNegative && !tracker.turnedPositive) {
      return "Turn your head left, then right.";
    }
    return tracker.turnedNegative ? "Now turn your head right." : "Now turn your head left.";
  }
  return "Liveness passed. Tap Verify face.";
}

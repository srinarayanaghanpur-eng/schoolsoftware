/**
 * Plain-language GPS proximity states for the attendance screen.
 * Pure function: distance/accuracy in, banner kind + text out.
 * Raw metres stay in the request payload and server record — never shown.
 */

export type ProximityKind = "ok" | "near" | "far" | "weak";

export function proximityState(
  distM: number,
  accM: number,
  limitM = 150
): { kind: ProximityKind; text: string } {
  if (accM > 50) {
    return {
      kind: "weak",
      text: "Weak GPS signal. Move to an open area and tap Refresh location."
    };
  }
  if (distM <= limitM) {
    return { kind: "ok", text: "You\u2019re at campus" };
  }
  if (distM > 1000) {
    return {
      kind: "far",
      text: "You\u2019re outside campus. Go to the school to check in."
    };
  }
  const near = Math.round(distM / 50) * 50;
  return { kind: "near", text: `You\u2019re about ${near} m from campus` };
}

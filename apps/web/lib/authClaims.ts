// Helper to force-refresh a Firebase user's ID token and read its custom claims.
//
// Why this exists: in this monorepo, `firebase/auth` type resolution picks up the
// React-Native variant of the SDK, whose `User.getIdTokenResult` is typed without the
// `forceRefresh` argument. At runtime the web app loads the real browser SDK, which
// does accept it. This wrapper isolates that one cast so the rest of the app stays clean.

type ForceRefreshUser = {
  getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }>;
};

/** Force-refreshes the token (to pick up updated custom claims) and returns the claims. */
export async function refreshClaims(user: unknown): Promise<Record<string, unknown> | undefined> {
  if (!user) return undefined;
  const result = await (user as ForceRefreshUser).getIdTokenResult(true);
  return result.claims;
}

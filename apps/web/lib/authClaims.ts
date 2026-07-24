// Helper to force-refresh a Firebase user's ID token and read its custom claims.
//
// Why this exists: in this monorepo, `firebase/auth` type resolution picks up the
// React-Native variant of the SDK, whose `User.getIdTokenResult` is typed without the
// `forceRefresh` argument. At runtime the web app loads the real browser SDK, which
// does accept it. This wrapper isolates that one cast so the rest of the app stays clean.

type ForceRefreshUser = {
  getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }>;
};

/**
 * Returns the user's custom claims, preferring a force-refreshed token (to pick
 * up role changes) but resilient to network failure.
 *
 * A forced refresh hits the network, which frequently fails on flaky mobile
 * connections. When that happens we fall back to the locally cached token — it
 * is still a valid, signed token and its claims are almost always current
 * (roles change rarely). Without this fallback the forced refresh throws, the
 * caller can't resolve the role, and the user is wrongly bounced to
 * "access denied" / a stuck loading screen.
 */
export async function refreshClaims(user: unknown): Promise<Record<string, unknown> | undefined> {
  if (!user) return undefined;
  const u = user as ForceRefreshUser;
  try {
    return (await u.getIdTokenResult(true)).claims;
  } catch {
    try {
      return (await u.getIdTokenResult(false)).claims;
    } catch {
      return undefined;
    }
  }
}

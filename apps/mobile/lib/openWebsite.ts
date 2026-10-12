/**
 * openWebsite — hand the user off to the production website (Vercel) in the
 * device browser. Always shows a "You are redirecting to the website" popup
 * first so the jump out of the app never surprises anyone.
 *
 * The site origin comes from EXPO_PUBLIC_SITE_URL (EAS / .env.local) so
 * previews and production can point at different deployments; the fallback is
 * the production Vercel deployment.
 */
import { Alert, Linking } from "react-native";

/** Production website origin (no trailing slash). Override with EXPO_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://schoolsoftware.vercel.app"
).replace(/\/$/, "");

/** Absolute website URL for an in-site path like "/admin/reports". */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Show the redirect popup; on Continue, open the page in the device browser.
 * `label` names the destination inside the popup, e.g. "Reports & exports".
 */
export function openWebsite(path = "/", label = "this page"): void {
  const url = siteUrl(path);
  Alert.alert(
    "You are redirecting to the website",
    `Press Continue to open ${label} in your browser.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        onPress: () => {
          void Linking.canOpenURL(url).then((ok) => {
            if (ok) {
              void Linking.openURL(url);
            } else {
              Alert.alert(
                "Can't open the browser",
                "Please check your internet connection and try again."
              );
            }
          });
        }
      }
    ]
  );
}

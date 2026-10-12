/**
 * App theme (reference: school-dashboards-v2.html).
 *
 * Single source of truth for color + font. Light and dark palettes mirror
 * the reference CSS variables exactly; screens read everything through
 * useTheme() and never import static color literals. Choice persists in
 * AsyncStorage and defaults to the OS scheme.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold"
} as const;

const light = {
  bg: "#F3F5FB",
  card: "#FFFFFF",
  ink: "#0F1535",
  mute: "#667091",
  faint: "#99A1BC",
  line: "#E7EAF4",
  blue: "#2F5BEA",
  blue2: "#4F8BFF",
  tint: "#EAF0FF",
  ok: "#12805C",
  okBg: "#E3F6EE",
  warn: "#9A6200",
  warnBg: "#FFF3D6",
  bad: "#C93A3F",
  badBg: "#FDE8E9",
  page: "#DCE2F0",
  heroFrom: "#1D3FD6",
  heroMid: "#3B72F5",
  heroTo: "#5B93FF",
  shadow: "rgba(40,60,130,0.07)"
} as const;

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  bg: "#0B0F22",
  card: "#151B38",
  ink: "#F2F4FF",
  mute: "#9AA3C7",
  faint: "#6C769C",
  line: "#252D55",
  blue: "#2F5BEA",
  blue2: "#5B93FF",
  tint: "#1E2B5E",
  ok: "#4FD1A0",
  okBg: "#103A2F",
  warn: "#F2B84B",
  warnBg: "#3B2E10",
  bad: "#FF8085",
  badBg: "#3F1B20",
  page: "#060815",
  heroFrom: "#1D3FD6",
  heroMid: "#3B72F5",
  heroTo: "#5B93FF",
  shadow: "rgba(0,0,0,0.35)"
} as const;

const THEME_KEY = "sriNarayana.themeChoice";

type ThemeContextValue = {
  mode: ThemeMode;
  dark: boolean;
  t: Palette;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  dark: false,
  t: light,
  toggle: () => undefined,
  setMode: () => undefined
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === "dark" ? "dark" : "light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") setModeState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, dark: mode === "dark", t: mode === "dark" ? dark : light, toggle, setMode }),
    [mode, toggle, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

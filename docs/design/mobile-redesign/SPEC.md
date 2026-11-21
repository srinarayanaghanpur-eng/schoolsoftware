# NarayanaOS Mobile Redesign — Implementation Specification

**Version:** 1.0 · **Owner:** Product / Design · **Target:** React Native (Expo) + self-contained HTML demo
**Demo frame:** 390 × 844 logical px (iPhone 13/14 class), 1× CSS px. Top safe area 47, bottom safe area 34.
**App:** Sri Narayana High School · Kukatpally, Hyderabad · Motto: LEARN • GROW • ACHIEVE.
**Source of truth inspected:** `apps/mobile/design-system/tokens.ts`, `app/teacher/{index,attendance,academics}.tsx`, `app/parent/{index,fees}.tsx`, `app/admin/{index,students,staff}.tsx`, `app/login.tsx`, role shells. Real labels, tabs, roles, data fields and flows are preserved.

---

## 1. Design principles

1. **Premium calm.** One clear job per screen, one primary CTA. Depth comes from soft shadows, tonal surfaces and generous whitespace — never noise.
2. **Thumb-first.** Primary actions live in the lower 55% of the screen. Minimum 44 × 44 pt targets, 8 pt gaps between targets.
3. **Progressive disclosure.** Lists → detail sheets → full screens. Sheets never exceed 78vh; destructive actions always confirm.
4. **Honest data.** Never invent live figures. Unavailable sections say so in plain language (as the current app does). Show timestamps for money and attendance.
5. **Status is never colour-only.** Pair every state with an icon and a word ("Paid", "Due", "Checked in").
6. **Calm motion.** Motion explains hierarchy (push/pop, sheet up) and confirms action (spring press, check-in success). It never decorates idle screens.
7. **Light-first, dark-equal.** Every surface, state and shadow has a dark counterpart. No feature is light-only.
8. **Accessible by default.** Contrast, labels, focus order, dynamic type and reduced motion are acceptance criteria, not polish.

**Avoid**

- Claymorphism, heavy/frosted glass, neon glows, 3D blobs, cartoon illustration, stock “diverse students” photos.
- More than one filled primary button per screen; competing gradients.
- Purple used for body text on white (use ink/secondary text).
- Raw GPS metres, accuracy figures, internal IDs, API errors or codes in UI copy.
- Dense tables, horizontal scrolling, modals stacked on modals, full-screen spinners.
- Emoji as icons; icon-only controls without accessible labels.
- Animations over 300ms except the one-time confetti; looping decorative motion.
- Tiny 10px body text; letter-spacing below -0.6px on headings.

---

## 2. Token architecture

Three layers: **primitive** (raw palette, never used by components) → **semantic** (theme-aware roles) → **component** (dimensions/behaviour). Components may reference semantic and component tokens only. Zero hex values outside the primitive/semantic blocks.

### 2.1 Primitive palette (62 tokens)

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Indigo** | `#EFEDFB` | `#E3DEF9` | `#C8BEF3` | `#A796EC` | `#876BE7` | `#6D4AFF` | `#5840D8` | `#3B2FA3` | `#2C227C` | `#1D1755` | `#120D36` |
| **Marigold** | `#FEF7E7` | `#FDECC6` | `#FADB92` | `#F7C95F` | `#F4B740` | `#E2A32A` | `#BE831B` | `#966313` | `#6B450D` | `#432A07` | — |
| **Mint** | `#E8F8F2` | `#CBF0E2` | `#97E2C9` | `#5FD1AC` | `#2CBB90` | `#12A87A` | `#0E8C65` | `#0B6B4E` | `#084C38` | `#052F23` | — |
| **Coral** | `#FDEDED` | `#FBD6D7` | `#F6ABAD` | `#F08084` | `#EA6166` | `#E5484D` | `#C73338` | `#A02529` | `#741A1D` | `#4A1012` | — |
| **Sky** | `#EBF3FE` | `#D5E5FD` | `#AACAFB` | `#7FADF9` | `#5591F8` | `#2E7CF6` | `#1C63D4` | `#154BA6` | `#0F3577` | `#0A224C` | — |

| Neutral / ink | Token | Hex |
|---|---|---|
| White | `neutral-0` | `#FFFFFF` |
| Paper | `neutral-25` | `#FBFAFE` |
| Cloud (canvas) | `neutral-50` | `#F6F5FB` |
| Haze | `neutral-75` | `#F1EFF9` |
| Mist | `neutral-100` | `#ECE9F6` |
| Line | `neutral-200` | `#DEDAF0` |
| Line strong | `neutral-300` | `#C9C3E4` |
| Muted | `neutral-400` | `#A9A4C2` |
| Tertiary | `neutral-500` | `#757096` |
| Secondary | `neutral-600` | `#4C4870` |
| Deep | `neutral-700` | `#2E2A4D` |
| Night | `neutral-800` | `#1D1A33` |
| Ink | `neutral-900` | `#12102A` |
| Void | `neutral-950` | `#0A0818` |

Dark canvas uses off-ramp values: canvas `#0E0C1F`, surface `#16142E`, raised `#1D1A3A`, line `#241F42` / `#2E2950` / `#3E3866`.

### 2.2 Semantic colour — light / dark

Components consume these CSS variables. Dark values are exact overrides under `[data-theme="dark"]`.

#### Surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F5FB` | `#0E0C1F` | App canvas |
| `--surface` | `#FFFFFF` | `#16142E` | Cards, inputs, app bar |
| `--surface-raised` | `#FFFFFF` | `#1D1A3A` | Sheets, menus, toast area |
| `--surface-sunken` | `#F1EFF9` | `#0A0818` | Search, skeletons, insets |
| `--surface-tint` | `#ECE8FF` | `#221C46` | Selected rows, info tints |
| `--surface-inverse` | `#12102A` | `#F4F3FA` | Toasts |
| `--scrim` | `rgba(18,16,42,.48)` | `rgba(0,0,0,.66)` | Sheet backdrop |
| `--scrim-strong` | `rgba(18,16,42,.72)` | `rgba(0,0,0,.82)` | Confirm dialogs |
| `--skeleton` | `#ECE9F6` | `#242040` | Skeleton base |
| `--skeleton-highlight` | `#F7F5FD` | `#2E2950` | Shimmer highlight |

#### Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--text` | `#12102A` | `#F4F3FA` | Headings, values |
| `--text-secondary` | `#4C4870` | `#C3BFE0` | Body secondary, subtitles |
| `--text-tertiary` | `#757096` | `#938DB8` | Metadata, placeholders, captions |
| `--text-disabled` | `#A9A4C2` | `#615C85` | Disabled labels |
| `--text-inverse` | `#FFFFFF` | `#12102A` | On inverse surfaces |
| `--text-on-primary` | `#FFFFFF` | `#FFFFFF` | On primary fills |
| `--text-link` | `#3B2FA3` | `#B9A8FF` | Links, “View all” |
| `--text-accent` | `#8A5A0A` | `#F4B740` | Marigold text (AA on white/dark) |
| `--text-success` | `#0B6B4E` | `#6DE7BE` | Success text (fill mint fails body contrast) |
| `--text-danger` | `#B3262B` | `#FF9A9D` | Error text (fill coral fails body contrast) |
| `--text-info` | `#154BA6` | `#9CC0FF` | Info text |

#### Borders & dividers

| Token | Light | Dark | Use |
|---|---|---|---|
| `--border-subtle` | `#ECE9F6` | `#241F42` | Card hairlines, dividers |
| `--border` | `#DEDAF0` | `#2E2950` | Inputs, secondary buttons |
| `--border-strong` | `#C9C3E4` | `#3E3866` | Emphasised outlines |
| `--border-focus` | `#6D4AFF` | `#A594EB` | Focus ring / focused input |
| `--border-danger` | `#E5484D` | `#F08A8D` | Error inputs |
| `--divider` | `#ECE9F6` | `#241F42` | List separators |
| `--nav-border` | `rgba(18,16,42,.06)` | `rgba(255,255,255,.08)` | Nav top edge |

#### Primary, accent, gradients

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#3B2FA3` | `#7C5CFF` | Primary fill, active tab |
| `--primary-pressed` | `#2B2178` | `#6A4BEB` | Pressed primary |
| `--primary-disabled` | `#C8BEF3` | `#332C5C` | Disabled primary |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | Text/icons on primary |
| `--primary-container` | `#ECE8FF` | `#241C4D` | Soft primary tint |
| `--on-primary-container` | `#1C1550` | `#DCD4FF` | Text on primary tint |
| `--primary-subtle` | `#F4F1FF` | `#1B1638` | Pressed secondary surface |
| `--gradient-primary-a` | `#3B2FA3` | `#5B3FE0` | Hero gradient start |
| `--gradient-primary-b` | `#6D4AFF` | `#8B6CFF` | Hero gradient end |
| `--accent` | `#F4B740` | `#F4B740` | Marigold fill, highlights |
| `--accent-pressed` | `#E2A32A` | `#F7C95F` | Pressed accent |
| `--accent-container` | `#FEF3D6` | `#3A2A0B` | Warm tint |
| `--on-accent` | `#12102A` | `#12102A` | Ink on marigold |
| `--on-accent-container` | `#4A3208` | `#FCE3A6` | Text on warm tint |

| Gradient token | Light | Dark | Angle |
|---|---|---|---|
| `--gradient-hero` | `#3B2FA3 → #6D4AFF` | `#5B3FE0 → #8B6CFF` | 135deg |
| `--gradient-hero-sheen` | `rgba(255,255,255,.16)` | `rgba(255,255,255,.12)` | radial 70% top-right |
| `--gradient-success` | `#0B6B4E → #12A87A` | `#145C46 → #2FD3A0` | 135deg |
| `--gradient-warm` | `#F4B740 → #FFD37A` | `#B07C1A → #F4B740` | 135deg |
| `--gradient-danger` | `#A02529 → #E5484D` | `#A02529 → #FF7A7E` | 135deg |
| `--gradient-fade` | `rgba(246,245,251,0) → #F6F5FB` | `rgba(14,12,31,0) → #0E0C1F` | 180deg |

#### Status & feedback

| Token | Light | Dark | Use |
|---|---|---|---|
| `--success` | `#12A87A` | `#2FD3A0` | Success fill, dots, bars |
| `--success-container` | `#E8F8F2` | `#0E2F26` | Success tint |
| `--on-success-container` | `#08402F` | `#C9F7E6` | Success text on tint |
| `--text-success` | `#0B6B4E` | `#6DE7BE` | Success body text |
| `--warning` | `#F4B740` | `#F7C95F` | Warning fill |
| `--warning-container` | `#FEF3D6` | `#3A2A0B` | Warning tint |
| `--on-warning-container` | `#4A3208` | `#FCE3A6` | Warning text on tint |
| `--text-warning` | `#8A5A0A` | `#F7C95F` | Warning body text |
| `--danger` | `#E5484D` | `#FF7A7E` | Error fill, destructive |
| `--danger-container` | `#FDEDED` | `#3A1418` | Error tint |
| `--on-danger-container` | `#5C0F13` | `#FFD9DA` | Error text on tint |
| `--text-danger` | `#B3262B` | `#FF9A9D` | Error body text |
| `--info` | `#2E7CF6` | `#5B9BFF` | Info fill |
| `--info-container` | `#EBF3FE` | `#12294A` | Info tint |
| `--on-info-container` | `#0F3470` | `#CDE0FF` | Info text on tint |
| `--text-info` | `#154BA6` | `#9CC0FF` | Info body text |
| `--badge-neutral-bg` | `#F1EFF9` | `#242040` | Neutral badge |
| `--badge-neutral-text` | `#4C4870` | `#C3BFE0` | Neutral badge label |

#### Pastel tile set (quick actions, subject chips, avatars)

| Token | Light bg | Dark bg | Light fg | Dark fg |
|---|---|---|---|---|
| Lavender | `#ECE8FF` | `#2A2350` | `#3B2FA3` | `#C3B4FF` |
| Peach | `#FFE9D6` | `#3A2418` | `#A34E0E` | `#FFC79B` |
| Mint | `#DDF6EC` | `#123528` | `#0B6B4E` | `#6DE7BE` |
| Sky | `#E3EFFE` | `#172B47` | `#154BA6` | `#9CC0FF` |
| Lemon | `#FEF4D2` | `#372C0F` | `#8A5A0A` | `#F7D77A` |
| Rose | `#FDE4E8` | `#3A1E24` | `#A02529` | `#FFA9AF` |

Contrast rule: pastel backgrounds are for icon tiles and avatars only. Text inside a tonal tile uses the ramp fg. Body text never sits on `--accent`, `--success`, `--danger` or `--info` fills.

### 2.3 Spacing, radii, shadows, z-index

#### Spacing (8 pt rhythm, half-step 2/4)

| Token | Value | Usage |
|---|---|---|
| `--space-0` | 2 | Hairline gaps, badge inset |
| `--space-1` | 4 | Icon/text optical gap |
| `--space-2` | 8 | Inline gaps, chip gaps |
| `--space-3` | 12 | Row internal, grid gap |
| `--space-4` | 16 | Card padding, list row padding |
| `--space-5` | 20 | Screen horizontal padding |
| `--space-6` | 24 | Section gaps, sheet padding |
| `--space-7` | 32 | Major section separation |
| `--space-8` | 40 | Hero internal padding |
| `--space-9` | 48 | Empty-state breathing room |
| `--space-10` | 64 | Bottom-nav height |
| `--space-11` | 80 | Large hero/illustration spacing |

Screen gutter = 20. Card gap in vertical stack = 14 (12–16 allowed). Grid gap = 12. Do not mix arbitrary values.

#### Radii (8 tokens)

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 8 | Badges, tiny tags |
| `--radius-sm` | 12 | Tonal tiles, icon buttons’ inner tiles |
| `--radius-md` | 16 | Inputs, search, bottom sheets, small cards |
| `--radius-lg` | 20 | Standard cards, list containers |
| `--radius-xl` | 24 | Nested feature panels |
| `--radius-hero` | 28 | Heroes, success panels |
| `--radius-pill` | 999 | Buttons, chips, search bar |
| `--radius-full` | 9999 | Avatars, rings, dots |

#### Shadows (7 tokens)

| Token | Light | Dark |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(18,16,42,.04)` | `0 1px 2px rgba(0,0,0,.32)` |
| `--shadow-sm` | `0 2px 8px rgba(18,16,42,.06)` | `0 2px 8px rgba(0,0,0,.36)` |
| `--shadow-md` | `0 8px 24px rgba(18,16,42,.08)` | `0 8px 24px rgba(0,0,0,.44)` |
| `--shadow-lg` | `0 16px 40px rgba(18,16,42,.12)` | `0 16px 40px rgba(0,0,0,.50)` |
| `--shadow-xl` | `0 24px 64px rgba(18,16,42,.18)` | `0 24px 64px rgba(0,0,0,.58)` |
| `--shadow-primary` | `0 12px 28px rgba(59,47,163,.28)` | `0 12px 28px rgba(109,74,255,.32)` |
| `--shadow-highlight` | `inset 0 1px 0 rgba(255,255,255,.60)` | `inset 0 1px 0 rgba(255,255,255,.06)` |

Cards use `--shadow-sm`; only heroes and the sticky CTA use `--shadow-primary`; sheets/toasts use `--shadow-lg`. Dark mode relies more on borders than shadows.

#### Z-index (9 tokens)

| Token | Value | Layer |
|---|---|---|
| `--z-base` | 0 | Screen content |
| `--z-raised` | 10 | Sticky mini-header, chart labels |
| `--z-sticky` | 20 | Sticky section headers |
| `--z-header` | 30 | Top app bar |
| `--z-nav` | 40 | Bottom navigation |
| `--z-scrim` | 50 | Sheet/dialog backdrop |
| `--z-sheet` | 60 | Bottom sheet / confirm dialog |
| `--z-toast` | 70 | Toasts |
| `--z-confetti` | 80 | One-time success confetti |

### 2.4 Component tokens (40 tokens)

| Group | Tokens |
|---|---|
| Touch/controls | `--tap-min: 44`; `--control-h-sm: 40`; `--control-h: 48`; `--control-h-lg: 52`; `--input-h: 52`; `--search-h: 48`; `--chip-h: 34`; `--icon-btn: 44`; `--nav-h: 64`; `--nav-safe: 34`; `--header-h: 56` |
| Buttons | `--btn-pad-x: 20`; `--btn-gap: 8`; `--btn-icon: 20`; `--btn-radius: 999`; `--btn-font: 15/22` |
| Cards/rows | `--card-pad: 16`; `--card-gap: 12`; `--row-min-h: 64`; `--row-pad-x: 16`; `--row-chevron: 18`; `--divider-inset: 68` |
| Tiles/badges | `--tile-icon: 40`; `--tile-h: 96`; `--badge-h: 22`; `--badge-pad-x: 8`; `--avatar-xs: 28`; `--avatar-sm: 36`; `--avatar-md: 44`; `--avatar-lg: 56` |
| Overlays | `--sheet-radius: 16`; `--sheet-max-h: 78vh`; `--sheet-pad: 20`; `--toast-min-h: 48`; `--toast-radius: 14`; `--toast-hold: 2600` |
| Data viz | `--ring-size: 144`; `--ring-stroke: 10`; `--progress-h: 8`; `--chart-bar-w: 14` |

**Token count:** 62 primitive + 78 semantic colour + 58 system (12 spacing, 8 radii, 7 shadows, 9 z-index, 16 motion, 6 icon sizes) + 40 component = **238 tokens**. Every colour token exists in both themes.

---

## 3. Typography

Fonts: **Plus Jakarta Sans** 700/800 for headings and numerals; **DM Sans** 400/500 for body, labels and controls.
Fallback stack (no network dependency): `"Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, sans-serif`; body `"DM Sans", "Segoe UI", system-ui, -apple-system, sans-serif`.
Never disable font scaling. Numerals use `font-variant-numeric: tabular-nums` in stats, money, times and marks.

| Role | Size | Line height | Weight | Letter spacing | Family | Usage |
|---|---|---|---|---|---|---|
| Display | 28 | 34 | 800 | -0.6 | Jakarta | Screen hero values, fee amount, % |
| Title | 22 | 28 | 800 | -0.3 | Jakarta | Page title, sheet title, success amount |
| Section | 17 | 24 | 700 | -0.2 | Jakarta | Card headings, student name, row emphasis |
| Body | 15 | 22 | 400 | 0 | DM Sans | Paragraphs, descriptions, notice body |
| Body Medium | 15 | 22 | 500 | 0 | DM Sans | Row titles, button labels, input text |
| Label | 13 | 18 | 500 | 0 | DM Sans | Metadata, helper text, secondary values |
| Caption | 11 | 16 | 500 | +0.2 | DM Sans | Timestamps, footnotes |
| Overline | 11 | 16 | 700 | +1.0 | Jakarta, uppercase | Section eyebrows: `TODAY’S CLASSES`, `FEES DUE` |
| Numeric | 22 | 28 | 800 | -0.3 | Jakarta, tabular | Stat tile values, ring centre |
| Nav label | 11 | 14 | 500 | 0 | DM Sans | Bottom-nav labels |

Rules: max 2 type families per screen; headings never below 17 except overline/caption; body never below 13; overline is the only uppercase role; line length 32–42 characters on mobile; dynamic type scales with layout reflow, no clipping.

---

## 4. Component specifications

States required everywhere: **default, pressed, focus-visible, disabled, loading**. Press = `scale(.96)` (large cards `.97`), 140ms spring. Focus = 2px `--border-focus` outline, 2px offset (or inset on nav). Disabled = 38% opacity + `--text-disabled`; no shadow; no press animation. Loading = fixed width, spinner replaces leading icon or sits before label, `aria-busy="true"`, label becomes a verb phrase ("Saving…", "Paying…").

### 4.1 Buttons

| Component | Spec | Default | Pressed | Focus-visible | Disabled | Loading |
|---|---|---|---|---|---|---|
| Primary button | H48, pad 0 20, radius 999, DM Sans 500 15, icon 20 + gap 8, `--shadow-primary` | `--primary` bg, `--on-primary` text | `--primary-pressed`, scale .96, shadow-xs | 2px `--border-focus` offset 2 | `--primary-disabled` bg, `--text-disabled` label, no shadow, `aria-disabled` | 18px spinner + “Saving…”/“Paying…”, width locked, no press |
| Secondary button | H48, pad 0 20, radius 999, 1px `--border-strong` | `--surface` bg, `--text`/`--primary` label | `--primary-subtle` bg, scale .96 | ring offset 2 | `--surface-sunken`, `--text-disabled`, border-subtle | spinner uses `--primary`, label “Updating…” |
| Destructive button | Same as primary | `--danger` bg, white | darker `#C73338` / `#E5484D` | ring `--border-danger` | 38% opacity | spinner white + “Signing out…” |
| Text/link button | H44 min, pad 0 4, 15/22 500 | `--text-link` | 70% opacity + underline | ring 2 | `--text-disabled` | inline spinner 14 |

One filled primary per screen (sheet CTA counts as the screen’s primary while open). Full-width (`block`) on forms, sheets and empty-state CTAs; inline pill elsewhere. Icon-only buttons never carry the primary role except the send action.

### 4.2 Icon button

44 × 44, radius 14, `--surface` bg, 1px `--border-subtle`, icon 20–22 `--text-secondary`. Pressed: `--surface-sunken`, scale .96. Focus: 2px ring. Disabled: 38%, no border change. Loading: 16px spinner. Always `aria-label` (`Notifications`, `Switch to dark mode`, `Back`). Badge (unread) sits top-right, 8px dot or 16px count.

### 4.3 Input / text field

Label 13/18 500 above (optional but required for forms); height 52; radius 16; 1px `--border`; bg `--surface`; padding 0 16; text 15/22 500; placeholder `--text-tertiary`; helper 11/16 below.
Focus: 2px `--border-focus` + 3px `rgba(109,74,255,.12)` halo; label turns `--text-link`.
Error: `--border-danger`; helper coral with alert icon; `aria-invalid="true"` + `aria-describedby`.
Disabled: `--surface-sunken`, `--text-disabled`, no halo.
Loading: trailing 16px spinner for async validation; field stays editable unless submitting.
Password: trailing eye toggle 44×44 hit area. OTP/amount variants keep same shell.

### 4.4 Search bar

H48, radius 999, bg `--surface-sunken`, 1px transparent border, search icon 18 at left 14, placeholder 15/22, optional filter icon button at right (40×40), clear “×” 40×40 when non-empty. Focus: `--surface` bg + 1px `--border-focus`; results update as typed (demo: instant filter). Loading: 16px spinner replaces magnifier. Empty query: no clear button. `role="searchbox"`, label “Search students”. Pressing `/` focuses it in the demo.

### 4.5 Chips / filter pills

H34, radius 999, pad 0 12, 13/18 500, gap 6, optional 14px icon.
Default: `--surface` bg, 1px `--border`; Selected: `--primary` bg, `--on-primary`, no border; Pressed: scale .96, selected darkens to `--primary-pressed`; Focus: 2px ring inset; Disabled: 38%; Loading: 72×34 shimmer chip.
Single-select groups use `role="radiogroup"` + arrow keys; multi-select use `aria-pressed`. Max 5 visible; horizontal scroll with 20px gutter, no scrollbar.

### 4.6 Cards

Radius 20, pad 16, `--surface`, 1px `--border-subtle`, `--shadow-sm`. Hero variant radius 28, pad 20, gradient `--gradient-hero`, white text, optional radial sheen, no border, `--shadow-primary`. Section card: overline header (11/16 700, +1.0, `--text-tertiary`) + trailing text link, 12px gap, divider `--divider`.
Pressable card: pressed scale .97 + `--surface-sunken`; focus ring; disabled 38%; loading = full-card skeleton with same radius. Never nest cards; use dividers and surface tints instead.

### 4.7 List row

Min height 64, pad 12 16, gap 12; leading avatar/tile 40; title 15/22 500 `--text`; subtitle 13/18 `--text-secondary`, 1 line; trailing value 13/18 600 or chevron 18 `--text-tertiary`; divider 1px inset-left 68. Pressed: `--surface-sunken`, scale .97; focus: 2px inset ring; disabled: 38%; loading: 3 skeleton lines (height 64). Rows are at least 44 high even in compact variants. Chevron means navigation; no chevron when row only shows data.

### 4.8 Stat tile

Equal-width (3-up: gap 10, pad 12), radius 16, `--surface`, 1px `--border-subtle`. Order: icon/tonal dot 28 → value 22/28 800 tabular → overline label 11/16 700. Optional delta 11 with ▲/▼. Toned value uses `--text-success`/`--text-danger`. Pressable variant scale .97 + focus ring. Loading: shimmer value bar 60×22 + label 48×10. Disabled: none (not an action).

### 4.9 Quick-action tile

2-column grid, gap 12, height 96, radius 20, `--surface`, 1px `--border-subtle`, centered. 40×40 tonal tile (radius 12, pastel bg/fg) with 22px icon, label 13/18 500 `--text-secondary` below, max 2 lines. Optional count badge top-right. Pressed: scale .96 + `--surface-sunken`; focus ring; loading: shimmer tile; disabled: 38% (e.g., feature flag off) with “Soon” badge.
Pastel assignment: Attendance=mint, Academics=lavender, Tasks=lemon, Inbox=rose; Finance=mint, Staff=sky, Approvals=lemon, Notices=lavender; Receipts=lavender, Report card=mint, Timetable=lemon, Message=rose, Hall ticket=sky.

### 4.10 Avatar

Circle; sizes 28/36/44/56; initials 11/13/15/17 700; bg pastel, fg matching ramp; image cover with initials fallback. Optional 2px `--surface` ring; presence dot 10 (success/away/danger) bottom-right with 2px surface border. Pressable (profile) scales .96. Loading: shimmer circle. Decorative avatars `aria-hidden`; identity avatars get `role="img"` + name label.

### 4.11 Badges

H22, radius 999, pad 0 8, 11/16 600, 1–2 words. Tones: neutral (`--badge-neutral-bg`), mint “Paid/Active/Present”, coral “Due/Absent/Error”, marigold “Pending/Late”, sky “Info/New”, lavender “Class/Section”. Dot variant: 6px dot + label. No pressed/disabled/loading states; never interactive (use chips instead). Max 2 per row.

### 4.12 Bottom navigation

Height 64 + 34 safe area; opaque `--surface` (96% + 1px `--nav-border` + `--shadow-sm`); 5 items max. Item: 22px icon + 11/14 500 label, gap 2, min touch 56×56. Inactive `--text-tertiary`; active `--primary` with a 40×28 `--primary-container` pill behind the icon; unread badge 16px coral count. Pressed: scale .94 + `--surface-sunken`; focus: 2px inset ring; disabled: n/a. Hide when keyboard is open or a sheet is presented. Safe-area padding inside. `aria-current="page"` on active.
Tab sets: Teacher `Home · Attend. · Academics · Inbox · Profile`; Parent `Home · Finance · Attend. · Homework · Profile`; Admin `Home · Finance · Exams · Notices · Profile`; Accountant `Home · Collections · Dues · Notices · Profile` (demo aliases Finance/Dues/Inbox).

### 4.13 Top app bar

Height 56 + safe top 47; pad 0 20; bg `--bg` (transparent over hero) or `--surface` with 1px bottom `--border-subtle` after scroll; z-header. Left: back icon button 44 or avatar; centre/left title 17/24 700 + optional 11/16 secondary subtitle; trailing 1–2 icon buttons. Title truncates 1 line, 12px from actions. On scroll, bg becomes `--surface` + `--shadow-sm` over 120ms. Back press = pop transition. Always one accessible label per action.

### 4.14 Bottom sheet

Backdrop `--scrim` (tap + Esc close); panel `--surface-raised`, top radius 16, max-height 78vh, pad 20, 36×4 handle (`--border-strong`), `--shadow-xl`, bottom safe area + 12. Enter: translateY 100%→0, 280ms spring + scrim fade 200; exit: 160ms ease-in. Focus moves to title/first control, focus trap, restore on close. Drag-to-dismiss optional (threshold 96px or velocity). Sticky footer CTA separated by `--divider`, 12px padding. States: default, loading (skeleton body, disabled CTA), error (coral inline banner + retry), success (content swaps, no close until “Done” or auto after confetti). `role="dialog" aria-modal="true"` + labelled title.
Confirm dialogs are centered sheets with title 17, body 15, secondary “Stay” + destructive “Log out”; no drag handle.

### 4.15 Toast

Bottom 16 above nav, min-height 48, radius 14, pad 12 16, bg `--surface-inverse`, text `--text-inverse` 13/18 500, leading 18px icon (check/alert/info), optional text action. `--shadow-lg`, max width 350, 1 line + optional 2nd line. Enter 220ms rise 8 + fade; exit 160ms; hold 2600ms; one at a time, queue. `role="status" aria-live="polite"`. No toast for destructive success without confirmation state; no error toasts that replace inline errors.

### 4.16 Empty state

Centered, max width 280, pad 24 0. 72px circle `--surface-sunken` with 32px icon in tone (neutral/mint/coral). Title 17/24 700, body 13/18 secondary centered, optional secondary button. Loading never shows an empty state (skeleton instead). Error variant: coral icon, “Couldn’t load this”, body + “Try again” secondary. Copy is specific, never “No data”.

### 4.17 Skeleton

Shapes mirror final layout exactly (no shift): page title 180×24, card 100%×120 radius 20, row 100%×64. Base `--skeleton`; highlight gradient `--skeleton-highlight` swept 1200ms linear infinite (translateX -100%→100%). `aria-busy="true"` on region; max 3 shimmering groups. Reduced motion: static blocks, no sweep. Never use a full-screen spinner.

### 4.18 Progress ring

144px outer, 10px stroke, round caps. Track `--border-subtle`; fill `--gradient-primary` (monthly %) or `--success` (today verified). Centre: value 28/34 800 tabular + label 13/18 secondary. Animate `stroke-dashoffset` 600ms `cubic-bezier(.22,1,.36,1)` once on mount/update; reduced: jump. Accessible `role="img"` + “Attendance 94 percent”. Indeterminate uses a 20px spinner, not a spinning ring.

---

## 5. Motion system

### 5.1 Tokens (16)

| Token | Duration | Easing / physics | Usage |
|---|---|---|---|
| `--motion-press` | 140ms | spring(damping 18, stiffness 320) / CSS `cubic-bezier(.2,0,0,1)` | Card, button, tile press |
| `--motion-press-scale` | 140ms | same | 0.96–0.97 buttons/tiles/cards/rows |
| `--motion-enter` | 240ms | `cubic-bezier(.16,1,.3,1)` | Card/list fade+rise 8px |
| `--motion-enter-slow` | 280ms | `cubic-bezier(.16,1,.3,1)` | Page hero, login block |
| `--motion-exit` | 160ms | `cubic-bezier(.4,0,1,1)` | Dismiss, toast out |
| `--motion-stagger` | 30ms/item, max 6 | linear | List reveal delay |
| `--motion-screen-push` | 260ms | `cubic-bezier(.22,1,.36,1)` | Drill-down (right→left) |
| `--motion-screen-pop` | 220ms | `cubic-bezier(.4,0,1,1)` | Back |
| `--motion-tab` | 180ms | `ease-out` | Tab/screen crossfade |
| `--motion-sheet` | 280ms | spring(damping 26, stiffness 260) / `cubic-bezier(.22,1,.36,1)` | Bottom sheet up |
| `--motion-scrim` | 200ms | linear | Backdrop fade |
| `--motion-toast-in` | 220ms | `ease-out` | Toast rise 8px + fade |
| `--motion-toast-out` | 160ms | `ease-in` | Toast fade |
| `--motion-shimmer` | 1200ms | linear infinite | Skeletons (only loop allowed) |
| `--motion-ring` | 600ms | `cubic-bezier(.22,1,.36,1)` | Progress ring fill |
| `--motion-success` | 320ms + 1200ms | spring / linear | Check scale + confetti once |

Toast hold = 2600ms. Success confetti fires once per successful event and never on re-entry.

### 5.2 Screen-transition rules

- **Push (list → detail, home → module):** new screen enters from +28px X with fade 260ms; outgoing screen shifts -12px X and fades to 0.88. Header title crossfades, no shared-element flight.
- **Pop (back/close):** outgoing exits +28px X 220ms; underlying screen returns from -12px to 0.
- **Tabs:** 180ms crossfade + 4px rise. Never slide horizontally between peer tabs; preserves orientation.
- **Bottom sheet:** scrim fades 200ms; sheet translateY 100%→0 280ms spring; dismiss reverses (160ms). Nested sheet not allowed.
- **Role switch:** reset stack to that role’s home, 220ms fade, toast “Switched to Parent”. No slide (prevents implying back).
- **Theme switch:** 200ms crossfade of surfaces/text only; no layout motion; persisted.
- **Login → home:** 280ms fade + 8px rise; replace stack (no back).
- **Success:** content crossfades 200ms, check scales 0.8→1 with spring, confetti 1200ms; reduced motion shows the static green check and text.

Motion budget: at most **2 simultaneous animations** per interaction (e.g., sheet + scrim, check + confetti). No animation on scroll except app-bar elevation. All transforms/opacity only — never animate width/height/top/left (except skeleton sweep and ring dasharray).

### 5.3 Reduced motion

`prefers-reduced-motion: reduce` (and in-app toggle in the demo via `?reduce=1`):
- Set all durations to `0.01ms`, disable stagger delays and spring overshoot.
- Screen changes become instant crossfade (opacity, 120ms max) or instant swap.
- Sheet/scrim appear instantly; no slide.
- Confetti disabled; success shows icon + copy. Skeleton static, no shimmer. Ring jumps to value.
- No parallax, no looping motion, no auto-advancing carousels.

---

## 6. Screen specifications (12)

Shared frame: status bar 47 (time 9:41, signal/wifi/battery in `--text`; white over gradients), top app bar, content scroll, bottom nav (except login, attendance success, sheets). Screen gutter 20; vertical stack gap 14; bottom content padding 24 + nav 98. Every screen has exactly one filled primary CTA unless a sheet is open.

### 6.1 Login / role picker

**Purpose:** sign in staff/parent, choose demo workspace; recover password.
**Sections (top→bottom):** 1) status bar + theme icon (top-right, 44). 2) Brand block: 64px logo tile (gradient indigo, white “N”), “Welcome back” 22/28 800, “Sign in to Sri Narayana High School” 13/18 secondary. 3) Demo role picker: 4 chips `Parent · Teacher · Admin · Accountant`, selected indigo, label “Demo workspace” overline. 4) Login ID input (placeholder “Username or email”, icon user, auto-capitalise). 5) Password input (eye toggle). 6) Row: “Remember me” checkbox + “Forgot password?” link. 7) Primary “Sign in” (block, 52). 8) Divider “or”. 9) Secondary “Use demo account”. 10) Error banner slot above CTA. 11) Footer “LEARN • GROW • ACHIEVE” caption + “Need help? Call the school office · 040 2300 1122”.
**Copy/errors:** empty → “Please enter your Login ID and password.”; wrong → “Wrong login ID or password. Please try again.”; network → “No internet connection. Please check and try again.”; loading → “Signing in…”.
**Interactions:** role chip selects workspace and prefills demo credentials hint (does not auto-login). Sign in validates, shows 900ms loading, routes to selected role home. “Use demo account” fills `priya.menon` / `demo1234` and focuses CTA. Enter submits; password eye toggles; theme toggle persists.
**States:** default; loading (button only, inputs disabled-ish but readable); inline error (coral banner + `aria-live`); empty (n/a); offline error. No skeleton on login.
**Animations:** (1) staggered entrance 280ms — logo, title, form blocks with 30ms stagger; (2) error banner 160ms fade + 4px settle (no shake under reduced motion).

### 6.2 Teacher Home

**Purpose:** start the day, check in, see classes/tasks/notices.
**Sections:** 1) Header: eyebrow “Good morning · Wed, 18 Nov”, title “Priya Menon”, actions bell (dot) + avatar 42. 2) Check-in hero:
- not checked in: gradient hero, “You haven’t checked in”, “Location is verified before attendance is saved · Wed, 18 Nov”, white pill “Check in”.
- checked in: mint-tinted card `success-container`, check tile, “Checked in · 8:42 AM”, “Present today”, “Check out” secondary.
- day complete: “Day complete”, “Checked out at 4:36 PM”, “View”.
3) Today’s classes: overline + “Timetable” link; rows “VIII-A · Mathematics” / “9:20–10:00 · Room 204”, “IX-B · Mathematics” / “11:10–11:50 · Room 301”; if none, empty “Your timetable will appear here once the school publishes it.”
4) Tasks: up to 2 rows, “Upload Class X internal marks” / “Due Fri, 21 Nov”, “Submit Unit 5 lesson plan” / “Due today”; “View all”.
5) Quick actions 2×2: Attendance (mint), Academics (lavender), Tasks (lemon), Inbox (rose, badge 3).
6) Month stats 3-up: 94% Attendance (primary), 18 Present days (mint), 2 Late marks (marigold).
7) Notices & events: “Annual Sports Day” / “Saturday, 29 November”, “Parent-Teacher Meeting” / “Sunday, 22 November, 9:00 AM”; row “View full school calendar”.
8) Secondary full-width “View full history”.
**Interactions:** hero → Teacher Attendance; quick actions → modules; notice row → Inbox detail; avatar → Profile; bell → Inbox. Pull-to-refresh (demo: toast “Updated just now”).
**States:** loading = skeleton header + hero + 3 rows; error = inline error card “Couldn’t load your day.” + “Try again”; empty classes/tasks/notices copy as above; no check-in = gradient hero.
**Animations:** (1) staggered list reveal 30ms on 4 sections; (2) hero check state 220ms crossfade after returning from check-in.

### 6.3 Teacher Attendance (GPS ring, check-in/out, success)

**Purpose:** verify on-campus location and mark attendance.
**Sections:** 1) App bar: back, title “Attendance”, subtitle “Wed, 18 Nov”. 2) Ring card: 144 ring, centre “8:42” / “Checked in” (or “— —” / “Not checked in”); meta row `Check in 8:42 AM · Check out — · Month 94%`. 3) Location card: verified → mint row “You’re on campus. Location verified just now.”; locating → marigold “Getting your location…”; off-campus → marigold “You’re about 1 km from campus. Move closer to check in.”; permission → coral “Location permission is off, so attendance can’t be marked.” + “Open settings”. Never show metres/accuracy. 4) Proximity bar (only while locating/off-campus) 8px with label “Almost there”/“Too far”. 5) Primary action “Check in” (fingerprint icon) or disabled until verified; “Check out” secondary when checked in. 6) “Refresh location” text button. 7) Month stats: 18 Present / 1 Absent / 2 Leave. 8) “This month” calendar with P/A/L marks. 9) Privacy caption: “Your location is checked only when you mark attendance. It is never tracked in the background.”
**Copy/success:** check-in success replaces content with success panel: green check 72, “Checked in at 8:42 AM”, “Location verified · Sri Narayana High School”, “Done” primary, “View month” secondary. Check-out success: “Checked out at 4:36 PM”, “7h 54m on campus”.
**Interactions:** Check in → 900ms submitting (“Saving…”) → success + confetti once → Done returns home with state updated. Check out requires confirmation sheet (“Finish your day?” body “You’ll check out at 4:36 PM.”; “Not yet” / “Check out”). Refresh re-simulates GPS. Demo dev controls (hidden long-press on ring) cycle on-campus / off-campus / permission-off.
**States:** locating skeleton on ring (static under reduced motion); verified; off-campus; permission denied; submitting; offline pending “1 attempt pending sync” + “Retry now”; error inline; success. Empty n/a.
**Animations:** (1) ring stroke fills 600ms; (2) success check spring 320ms + confetti 1200ms once (static under reduced motion).

### 6.4 Teacher Academics / Homework

**Purpose:** see assignment/timetable, post homework, track syllabus and exams.
**Sections:** 1) Title “Academics” + segmented control `Timetable | Homework`. 2) Assignment card: “Mathematics” / “Classes VIII-A, IX-B · Employee T-2041”. 3) This month progress: Attendance 94% (mint bar), Days recorded 18/22. 4) Homework panel:
- `Homework` tab: “Post homework” primary CTA; rows “Trigonometry — Exercise 8.3 (Q1–Q10)” / “VIII-A · Due Thu, 19 Nov · 38/42 submitted”; “Quadratic equations worksheet” / “IX-B · Due Fri, 20 Nov · 31/42 submitted”; “Homework to review” count 6.
- `Timetable` tab: day chips `Mon–Sat`; rows “9:20 VIII-A Mathematics · Room 204”, “11:10 IX-B Mathematics · Room 301”, “2:00 VIII-A Remedial · Lab 2”; empty “Your timetable will appear here once the school publishes it.”
5) Syllabus progress: “Unit 5 — Trigonometry” 72%, “Unit 6 — Statistics” 20%. 6) Exam timetables: row “Mid-Term · 20–27 Oct” + “View schedule”; “Pre-Final · 12–19 Jan” badge “Draft”. 7) School calendar: “Annual Sports Day · 29 Nov”, “PTM · 22 Nov”, “Winter break · 24 Dec–1 Jan”.
**Post-homework sheet:** fields Class (VIII-A/IX-B), Subject (Mathematics, prefilled), Title, Due date (19 Nov 2026), Instructions (multiline), “Notify parents” switch on; CTA “Post homework”. Validation: title ≥ 5 chars, due date today or later. Success toast “Homework posted · 28 parents notified” + row prepended.
**Interactions:** segment switches; Post opens sheet; exam row → toast/schedule sheet; calendar row → Inbox detail.
**States:** loading skeleton rows; empty timetable/review; error “Couldn’t load academics.” + retry; sheet loading “Posting…”; success as above.
**Animations:** (1) segment crossfade 180ms; (2) sheet slide 280ms; posted row enters 240ms + success check.

### 6.5 Parent Home

**Purpose:** child snapshot, fees, services, homework, notices.
**Sections:** 1) Header eyebrow “Welcome · Good morning”, title “Ramesh Reddy”, bell + avatar. 2) Child switcher: two pills with avatars `Aarav Reddy · VIII-A` (selected), `Diya Reddy · VI-B`. 3) Child card: avatar 50, “Aarav Reddy”, “Class VIII-A · Adm SNH/2023/0184”, badge “Class VIII-A”. 4) Fees-due hero (gradient): overline “FEES DUE”, ₹18,500 display, “₹23,500 paid of ₹42,000 · Term 2”, white “Pay now”. If zero: “ALL CLEAR”, “No dues right now”, “View receipts”. 5) Services grid (5 tiles, 3+2 wrap): Receipts (lavender), Report card (mint), Timetable (lemon), Message (rose), Hall ticket (sky). 6) Recent receipts: “₹21,000 · UPI” / “12 Jun 2026” (RCPT-2026-0184), “₹2,500 · Cash” / “05 Apr 2026”; “View all”. 7) Homework: badge “2 due”; “Trigonometry — Exercise 8.3” / “Mathematics · Due tomorrow”; “French Revolution notes” / “Social · Due Fri, 20 Nov”. 8) School notices: “Annual Sports Day — 29 November” body + date badge; “PTM — 22 November, 9:00 AM”. 9) Full-width primary “Message the school”.
**Interactions:** child switch updates every card with 180ms crossfade; Pay now → Fees screen with sheet open; service tiles route; notice card → Inbox detail; message → Inbox compose (toast in demo).
**States:** skeleton rows; “No student is linked to this account yet. Please contact the school office.” + “Call office”; no fees (all-clear hero); no homework “No homework due — all caught up.”; no notices “No notices right now.”
**Animations:** (1) staggered card reveal; (2) child switch 180ms crossfade + 4px rise.

### 6.6 Parent Fees + payment sheet + success

**Purpose:** understand dues, pay, retrieve receipts.
**Sections:** 1) Title “Finance” + child switcher. 2) Identity row: avatar 46, “Aarav Reddy”, “Class VIII-A · Adm SNH/2023/0184”. 3) Outstanding hero: overline “OUTSTANDING”, ₹18,500, “₹23,500 paid of ₹42,000 · Term 2 due 30 Nov”, white “Pay now”. 4) Fee breakdown card: Tuition ₹32,000; Transport ₹8,000; Exam fee ₹2,000; total ₹42,000; paid ₹23,500; balance ₹18,500 (rows + dividers, balance bold). 5) Payment history: overline + chips `All · UPI · Cash · Card`; rows “₹21,000 · UPI” / “Aarav Reddy · Receipt RCPT-2026-0184” / “12 Jun 2026”; “₹2,500 · Cash” / “Receipt RCPT-2026-0091” / “05 Apr 2026”; caption “Tap a payment to share its receipt.”
**Payment sheet:** title “Pay fees”, subtitle “Aarav Reddy · Class VIII-A”; amount ₹18,500 28/34; breakdown “Term 2 balance ₹18,500”; methods `UPI` (default), `Card`, `Netbanking`; UPI apps `GPay · PhonePe · Paytm`; note “Payments are processed securely by the school.”; primary “Pay ₹18,500”; secondary “Cancel”. Processing: button “Paying…” spinner, methods disabled, 1200ms. Failure: inline coral “Payment didn’t go through. No money was deducted.” + “Try again”. Success: replace sheet content — check 72, “Payment successful”, ₹18,500, “Receipt RCPT-2026-0412 · 18 Nov 2026 · UPI”, “Download receipt” secondary + “Done” primary; confetti once.
**Interactions:** Pay now opens sheet; method/app selection; Pay → processing → success; Done closes and updates outstanding to “All clear” + prepends history row; receipt row → toast “Receipt shared”. Download → toast “Receipt saved to Downloads” (demo).
**States:** loading skeleton; no student error; empty history “No payments recorded yet.”; failure; processing; success; all-clear hero.
**Animations:** (1) sheet slide + scrim; (2) success check spring + confetti once (single fire).

### 6.7 Parent Exams / Report card

**Purpose:** view results, subject performance, download/share report card.
**Sections:** 1) App bar back + title “Exams”, child switcher. 2) Term chips `FA-2 · Mid-Term · Pre-Final` (Mid-Term selected). 3) Result hero: gradient, “MID-TERM 2026”, “86.7%” display, “Grade A2 · Rank 4 of 42”, caption “Published 24 Nov 2026”. 4) Subject performance card: six rows with subject, marks “88/100”, grade badge, 4px progress bar: English 88 A1, Hindi 82 A2, Mathematics 94 A1, Science 91 A1, Social 86 A1, Telugu 79 B1. 5) Co-scholastic: “Art & Craft A”, “Physical Education A”, “Discipline A”. 6) Attendance: “178 of 190 days · 94%”. 7) Teacher remark card: “A consistent performer. Improve Telugu writing speed before Pre-Finals.” — Class teacher, VIII-A. 8) Actions: primary “Download report card”, secondary “Share”; divider; row “Pre-Final hall ticket” / “Available from 5 Jan” + “View”.
**Interactions:** term chip swaps data with 180ms crossfade (demo repeats/hall-ticket empty for other terms); download toast; share opens demo share sheet → toast; hall ticket shows empty state until published.
**States:** loading skeleton hero+rows; “Results for this term will be published on 24 Nov.” empty; error “Couldn’t load results.” + retry; no rank “Rank not published”.
**Animations:** (1) bars grow 600ms with 30ms stagger; (2) term crossfade 180ms.

### 6.8 Admin Home

**Purpose:** daily school snapshot and fast access to finance/staff/approvals.
**Sections:** 1) Header eyebrow “Good morning · Wed, 18 Nov”, title “Kavitha Rao”, avatar 42. 2) Collections hero: overline “COLLECTED THIS MONTH”, ₹12,48,500, white “Details”; 7-day bar chart (Mon–Sun, bars 14px, today highlighted marigold). 3) KPI row: 1,284 Students (lavender); 1,186/1,284 Present (mint); ₹4.82L Due (coral). 4) Fee collection card: “Collected against demand” 78% (mint) progress; rows “₹86,40,000 Total collected”, “186 students with dues / ₹4,82,000 outstanding”, “Expenses & cashflow”. 5) Pending approvals (badge 3): “Sneha Kulkarni · Sick leave · 19 Nov”, “Ravi Teja · Casual leave · 21 Nov”, “Anitha Rao · Half-day · today”; “View all”. 6) Quick actions 2×2: Finance (mint), Staff (sky), Approvals (lemon, badge 3), Notices (lavender). 7) Recent payments: “Aarav Reddy · ₹18,500 · UPI · 9:12 AM”, “Diya Sharma · ₹6,200 · Card · 9:04 AM”, “Ishaan Gupta · ₹2,400 · Cash · 8:51 AM”; “View all”.
**Interactions:** hero Details → Finance; KPI cards → Students / Attendance overview / Dues; approval row → Approvals; quick actions route; payment row → receipt toast.
**States:** skeleton hero + cards; error; approvals empty “Nothing waiting on you. All caught up.”; payments empty “No payments recorded yet today.”
**Animations:** (1) chart bars grow 600ms stagger 30ms; (2) section stagger.

### 6.9 Admin Students list + student detail sheet

**Purpose:** find a student, see dues/attendance, contact parent.
**Sections:** 1) App bar back + title “Students”. 2) Caption “1,284 students on roll”. 3) Search bar “Name, admission no. or phone” + filter icon. 4) Chips `All · Defaulters · New`. 5) Section headers `CLASS VIII · 268`; rows: avatar, “Aarav Reddy”, “SNH/2023/0184 · Ramesh Reddy”, trailing “₹18,500 due” (coral) or “Paid” mint badge, chevron. 6) “Load more students” secondary at end.
**Detail sheet:** title “Aarav Reddy”, subtitle “Class VIII-A · Adm SNH/2023/0184”; tabs `Overview · Fees · Attendance`.
- Overview: parent “Ramesh Reddy · +91 98490 12345”; buttons “Call” secondary + “Message” primary (compact); rows Class teacher “Mrs. Sharma”, Transport “Route 7 · Stop: KPHB Phase 3”, Joined “12 Jun 2023”.
- Fees: total ₹42,000 / paid ₹23,500 / due ₹18,500; last payment “₹21,000 · UPI · 12 Jun 2026”; row “View full fee ledger”.
- Attendance: 92% this term, 7 absences, row “Open attendance”.
Footer: secondary “Open full profile”. Close via handle, backdrop, Esc.
**Interactions:** search filters instantly (name/adm/parent); chips filter defaulters/new; row opens sheet; tab switches; Call shows confirm? demo toast “Calling Ramesh Reddy…”; Message → toast; full profile → toast.
**States:** search loading spinner in field; “No students match “Aarav”.” empty; error retry; sheet loading (skeleton 3 rows); sheet error.
**Animations:** (1) sheet slide 280ms + scrim; (2) row stagger 30ms (max 6).

### 6.10 Admin Attendance overview

**Purpose:** see school-wide attendance and act on absences.
**Sections:** 1) App bar back + title “Attendance”; date pill “Today · Wed, 18 Nov” + calendar icon. 2) Segmented `Students | Staff`. 3) Hero card: 144 ring 92.4%, “1,186 present of 1,284”, badge “On track” mint. 4) Stat tiles 4-up (2×2): Present 1,186 (mint), Absent 62 (coral), Late 36 (marigold), Leave 0 (neutral). 5) Class-wise card: rows with 8px bars — VI 96.2%, VII 94.8%, VIII 93.1%, IX 90.4%, X 88.0%. 6) Staff card: “82 of 86 checked in”, avatar stack + “4 yet to check in”; rows “Sneha Kulkarni · Not checked in” badge “Pending”, “Ravi Teja · Checked in 8:38 AM”. 7) “Absent today” list: 6 names, “View all 62”. 8) Secondary “Share today’s report” + caption “Report generated at 10:05 AM”.
**Interactions:** Students/Staff segment swaps content 180ms; date pill opens date sheet (demo: yesterday/today); class row → toast “VIII-A detail coming soon” (or sheet listing sections); share → toast “Attendance report shared”.
**States:** loading skeleton ring+rows; error; holiday empty “School closed today — no attendance to show.”; staff empty; no absences “Everyone is in today.”
**Animations:** (1) ring fill 600ms; (2) class bars grow 600ms stagger 30ms.

### 6.11 Inbox / Notices

**Purpose:** read school notices and messages, act on leave/task items.
**Sections:** 1) App bar title “Inbox”, subtitle “3 unread”, trailing “Mark all read” text button. 2) Chips `All · Notices · Leave · Messages` (All selected). 3) Pinned notice card (lavender tint): “Annual Sports Day — 29 November” / “Track events begin at 8:00 AM. Students report to the main ground in house colours.” / “2h ago” + “Read more”. 4) List rows: unread dot 8 mint; sender/title 15/22 500; snippet 13/18 secondary 1 line; time 11 right. Items: “Parent-Teacher Meeting” / “Slots open for 22 Nov, 9:00 AM–12:30 PM” / “Yesterday” (unread); “Half-yearly exam timetable” / “Classes VI–X · exams begin 20 Oct” / “Mon”; “Leave approved” / “Your sick leave for 18 Nov is approved.” / “Sun”; “Mrs. Sharma” / “Aarav’s Science project is excellent.” / “Sat”. 5) Empty state when filtered.
**Detail sheet:** title, sender “School office · Notice”, date, body 3–4 paragraphs, attachment row “Sports_Day_Schedule.pdf · 240 KB”, secondary “Share”, primary “Mark as read” → becomes “Done” (closes sheet).
**Interactions:** filter chips; row opens sheet (marks read after 600ms, unread count decrements); Mark all read → toast “All caught up”; share → toast; drag handle/Esc.
**States:** loading skeleton 4 rows; empty “You’re all caught up.”; error retry; unread state; read state (no dot, weight 500).
**Animations:** (1) list stagger 30ms; (2) sheet slide.

### 6.12 Profile / Settings

**Purpose:** identity, preferences, theme, role switch, sign out.
**Sections:** 1) App bar title “Profile”. 2) Identity: avatar 56, “Ramesh Reddy”, badge “Parent” + “Aarav Reddy · VIII-A” caption; row “Login ID · parent.demo@narayana” with copy icon. 3) Preferences card: “Appearance” segmented `Light | Dark | System`; “Language” row “English” → chevron; “Notifications” switch rows “Fee reminders”, “Attendance alerts”, “School notices” (all on). 4) Workspace card: overline “SWITCH WORKSPACE”; 2×2 role tiles `Parent · Teacher · Admin · Accountant` with pastel icons, current marked “Current”; caption “Demo only — real workspaces follow your login.” 5) Support card: rows “Help & support”, “Privacy policy”, “About NarayanaOS · v2.4.0”. 6) Destructive secondary “Sign out” (coral text). 7) Footer “Sri Narayana High School · Kukatpally, Hyderabad”.
**Theme toggle:** instant 200ms crossfade, persists in demo storage; System reads `prefers-color-scheme`. Role switch: confirm bottom sheet “Switch to Teacher?” body “You’ll leave the Parent workspace. Your data stays safe.” + “Switch” primary / “Stay” secondary; on switch, nav set changes, route to role home, toast “Switched to Teacher”.
**Sign out:** confirm sheet “Sign out of this device?” body “You’ll need your login ID to return.”; destructive “Sign out” + “Stay”; returns to Login with cleared fields, toast “Signed out”.
**States:** light/dark/system; role switching loading 400ms; sheet states; copy toast “Login ID copied”; empty n/a; error none.
**Animations:** (1) theme crossfade 200ms; (2) role switch fade 220ms after sheet close.
**Accountant note:** Accountant workspace aliases Admin Home (Collections emphasis), Parent Fees as Collections, Students filtered to Defaulters as Dues, Inbox as Notices, this Profile. Nav labels `Home · Collections · Dues · Notices · Profile`.

---

## 7. Accessibility checklist

- [ ] **Contrast:** body/label text ≥ 4.5:1; large text (≥22 bold / ≥28 regular) and icons ≥ 3:1. Use `--text-success/--text-danger/--text-info` for body, never mint/coral/sky fills. Check `--text-on-primary` on `--primary` (light 9.9:1, dark 5.2:1), `--text` on `--bg`/`--surface`, and dark `--text-secondary` on `--surface` (≥ 7:1). Badges: label vs tint ≥ 4.5:1.
- [ ] **Names & roles:** every button/icon has an accessible name; icon-only actions labelled (“Notifications”, “Back”, “Clear search”); current tab `aria-current="page"`; switches `role="switch"` + `aria-checked`; chips `role="radio"`/`aria-pressed`; sheets `role="dialog" aria-modal="true"` + `aria-labelledby`.
- [ ] **Focus:** visible 2px `--border-focus` ring with 2px offset on all interactive elements; focus never lost after navigation (focus the new screen `<h1>` with `tabindex="-1"`); sheet opens → focus first control, closes → restore trigger; focus trap inside sheet; no positive tabindex.
- [ ] **Touch targets:** ≥ 44×44 pt for every control, including close, eye, chevron rows, chips (34 high + 5px invisible vertical padding), nav items (56 wide). 8 px minimum between adjacent targets.
- [ ] **Keyboard (demo):** Tab/Shift+Tab logical order; Enter/Space activate; Esc closes sheet; Arrow keys move within radio/chip groups; `/` focuses search; focus ring visible; no keyboard traps outside modal.
- [ ] **Reduced motion:** honours `prefers-reduced-motion`; no confetti, shimmer, spring overshoot, slide or stagger; status still communicated by icon + text; in-app “Reduce motion” demo toggle mirror.
- [ ] **Dynamic type:** layout reflows, no truncation of critical values; text containers use min-height rather than fixed height; 200% zoom/type shows all content; single-line titles may truncate but accessible name is full; buttons grow vertically rather than clip; no `allowFontScaling={false}`.
- [ ] **Colour independence:** due/paid, present/absent, success/error always add icon + word; charts have value labels and patterns/highlights, not colour alone.
- [ ] **Screen readers:** headings announced in order (h1 per screen, h2 per card); list rows announce title, subtitle and trailing status as one unit; money announced “rupees eighteen thousand five hundred”; times include AM/PM; skeleton regions `aria-busy`.
- [ ] **Motion & timing:** toasts ≥ 2600ms and dismissible; no time-limited actions; payment processing announced “Processing payment”; success announced assertively once.
- [ ] **Forms:** visible labels, `autocomplete`, input types (`email`, `tel`), errors tied via `aria-describedby`, `aria-invalid`; validation message text, not colour.
- [ ] **Safe areas & orientation:** content never under notch/home indicator; 44pt status/gesture respect; portrait only for demo; no horizontal scroll at 320px width.

---

## 8. Implementation notes — single self-contained HTML demo

### 8.1 File & frame

One file, **< 4000 lines**, zero network requests, zero external JS/CSS/fonts/images. Use `<style>` + inline SVG symbols + vanilla ES2020 in `<script>`. No emoji anywhere.

```
<!doctype html>
<html data-theme="light" data-role="teacher">
<body>
  <div class="stage">                 <!-- 390×844, centered, neutral #E9E7EF backdrop -->
    <div class="phone">               <!-- overflow hidden; radius 44; shadow-xl -->
      <div class="statusbar">9:41 · signal · wifi · battery</div>
      <main id="app" aria-live="off"></main>
      <nav id="nav" class="bottom-nav" aria-label="Primary"></nav>
      <div id="sheet-root"></div>
      <div id="toast-root" aria-live="polite"></div>
      <div id="confetti-root" aria-hidden="true"></div>
    </div>
  </div>
</body>
```

Scale the 390×844 stage to fit smaller viewports with `transform: scale(min(1, vw/430, vh/900))`; never reflow the design. On large screens show it centered on a soft neutral background with a small “NarayanaOS · 390×844” caption outside the frame.

### 8.2 CSS architecture

1. `:root` — primitives as raw custom properties (`--indigo-700`, `--neutral-900`, …).
2. `:root` — semantic vars mapped for light (`--bg`, `--text`, …).
3. `[data-theme="dark"]` — overrides every semantic colour, shadow and gradient. No component rule may contain a hex value.
4. Component tokens on `:root` (heights, radii, paddings, `--tap-min`).
5. Utilities: `.stack` (flex column, gap 14), `.row`, `.grid-2`, `.card`, `.overline`, `.sr-only`, `.press` (transform + transition), `.scroll` (overflow-y auto, overscroll contain, hide scrollbar).
6. Screens: `.screen { display:none } .screen.is-active { display:block; animation: enter 240ms ... }`; scroll area height `calc(844px - statusbar - appbar - nav)` with `padding-bottom: 24px`.
7. `@media (prefers-reduced-motion: reduce)` sets motion vars to `0.01ms`, disables stagger via `--i: 0`, forces `.shimmer { animation:none }`.
8. `:focus-visible` global ring; `:focus:not(:focus-visible){outline:none}`.
9. `@supports` optional; no `color-mix` requirement (use explicit semantic tokens).
10. Print not required.

### 8.3 Icon set (inline SVG sprite)

`<svg style="display:none"><symbol id="i-…" viewBox="0 0 24 24">…</symbol>…</svg>`; use 1.8px stroke, round caps/joins, `currentColor`, 20/22 default. Required ids (~34): `home, calendar-check, book, inbox, user, bell, chevron-right, chevron-left, arrow-left, search, x, check, check-circle, alert-circle, info, map-pin, navigation, fingerprint, log-out, receipt, wallet, users, bar-chart, settings, moon, sun, monitor, credit-card, download, share, phone, message, filter, plus, clock, shield, school, task, camera, more-horizontal, refresh, copy, eye, eye-off`. No Material Icons dependency; recreate geometry. Status bar icons drawn as simple SVG paths.

### 8.4 JS screen state machine

```js
const state = {
  screen: "login",          // login|teacher-home|teacher-attendance|teacher-academics|
                            // parent-home|parent-fees|parent-exams|admin-home|
                            // admin-students|admin-attendance|inbox|profile
  stack: [],                // for back/push
  role: "teacher",          // parent|teacher|admin|accountant
  theme: "light",           // light|dark|system
  childId: "aarav",
  tab: "home",
  sheet: null,              // e.g. {type:"payment", step:"form"|"processing"|"success"}
  toast: null,
  attendance: "checked-in", // not-checked-in|locating|on-campus|off-campus|denied|checked-in|checked-out
  homeworkTab: "homework",
  examTerm: "midterm",
  inboxFilter: "all",
  unread: 3,
  studentsQuery: "",
  studentFilter: "all",
  reduceMotion: false
};
```

- `go(screen, {push=true, direction='push'})`: set stack, call `render()`, apply `.enter-push`/`.enter-pop` classes, move focus to screen `h1`, update nav active state, reset scroll to top.
- `back()`: pop stack; if empty, go role home. Browser Back not required but Esc on non-sheet screens triggers back.
- `render()`: one function per screen returning a template string from `DATA`; inject into `#app`; call `afterRender()` to bind nothing (use event delegation) and start stagger animations via CSS `--i`.
- Event delegation: `document.addEventListener('click', e => { const el=e.target.closest('[data-action]'); ... })`. Action map (~45): `login`, `set-role`, `toggle-theme`, `nav`, `back`, `open-sheet`, `close-sheet`, `check-in`, `confirm-checkout`, `pay`, `pay-done`, `mark-all-read`, `open-notice`, `select-child`, `select-tab`, `set-exam-term`, `search-students`, `filter-students`, `open-student`, `sheet-tab`, `sign-out`, `confirm-sign-out`, `switch-role`, `reduce-motion`, `copy-login`, `toast`, `download`, `share`, etc.
- `renderSheet()` handles types `payment`, `checkout`, `homework`, `student`, `notice`, `role-switch`, `signout`, `confirm`; locks body scroll; renders scrim + panel; `openSheet()` stores `lastFocus`, focus `[data-autofocus]`; `closeSheet()` restores.
- Toast queue: push message, render one, 2600ms timeout, fade out; never stack more than one.
- Confetti: 24 `<i>` particles, random x/rotation/colour from primary/marigold/mint/sky, 1200ms CSS animation, then remove; guard `firedOnce` per success event; skip if reduced motion.
- Persist theme/role/child with `try { localStorage.setItem(...) } catch {}`; hydrate on load. Reset demo button available via long-press logo (5s) → dev panel with GPS state, payment result, reduce motion, reset.

### 8.5 Fake data (single `DATA` object)

- **School:** `Sri Narayana High School`, `Kukatpally, Hyderabad`, motto `LEARN • GROW • ACHIEVE`, phone `040 2300 1122`.
- **Teacher:** Priya Menon, Mathematics, T-2041, VIII-A/IX-B, 94%, 18 present, 2 late, check-in 8:42 AM, checkout 4:36 PM, avatar “PM”.
- **Parent:** Ramesh Reddy, children Aarav Reddy (VIII-A, SNH/2023/0184) and Diya Reddy (VI-B, SNH/2024/0412).
- **Admin:** Kavitha Rao; students 1,284; present 1,186; absent 62; late 36; dues ₹4,82,000; collected this month ₹12,48,500; staff 86 checked-in 82.
- **Fees:** total ₹42,000 = tuition ₹32,000 + transport ₹8,000 + exam ₹2,000; paid ₹23,500; due ₹18,500; receipts RCPT-2026-0184 (₹21,000, UPI, 12 Jun 2026) and RCPT-2026-0091 (₹2,500, Cash, 05 Apr 2026); new receipt RCPT-2026-0412.
- **Exams:** Mid-Term 2026 — English 88 A1, Hindi 82 A2, Mathematics 94 A1, Science 91 A1, Social 86 A1, Telugu 79 B1; total 520/600, 86.7%, A2, rank 4/42; attendance 178/190.
- **Students:** Aarav Reddy (VIII-A, due ₹18,500), Diya Sharma (VI-B, paid), Ishaan Gupta (IX-B, due ₹6,200), Ananya Rao (X-A, paid), Vihaan Kumar (VII-C, due ₹12,800), Sahasra Varma (VIII-B, paid), Arjun Naidu (IX-A, due ₹2,400), Meera Iyer (VI-A, paid).
- **Homework:** Trigonometry Exercise 8.3 (VIII-A, due 19 Nov, 38/42), Quadratic equations (IX-B, due 20 Nov, 31/42), French Revolution notes (Social, due 20 Nov).
- **Notices:** Sports Day 29 Nov; PTM 22 Nov 9:00 AM–12:30 PM; Half-yearly timetable; Leave approved; Sharma message. Unread 3.
- **Timetable:** 8:15 assembly; 9:20 VIII-A Maths Room 204; 10:10 IX-B Maths Room 301; 11:50 VIII-A Maths; 2:00 remedial Lab 2.
- **Class attendance:** VI 96.2, VII 94.8, VIII 93.1, IX 90.4, X 88.0.
- **Dates:** all copy fixed to **Wed, 18 November 2026**; do not use live `new Date()` for displayed copy (only for demo clock if desired).

### 8.6 Interaction wiring (must be functional)

| Area | Control | Result |
|---|---|---|
| Login | Role chips | Select workspace, update hint, persist `state.role` |
| Login | Sign in | Empty/length validation → inline error; success → loading 900ms → role home |
| Login | Use demo account | Fill credentials, focus Sign in |
| Login | Forgot password | Sheet with “Call office 040 2300 1122” + “Email office”; close |
| Theme | Sun/moon toggles | Toggle `data-theme`, crossfade, persist |
| Nav | Tabs | Navigate within role; active pill moves; no history pollution |
| Attendance | Check in | GPS state check; 900ms saving; success + confetti; update home state |
| Attendance | Check out | Confirm sheet → success state |
| Attendance | Open settings (denied) | Toast “Open Settings → Location” (demo) |
| Academics | Homework segment | Switch list; preserve scroll |
| Academics | Post homework | Sheet validation; success toast; prepend row; notify count |
| Parent | Child switcher | Update all child-specific values with 180ms fade |
| Parent | Pay now | Payment sheet; method selection; processing; success; update fees to all-clear; prepend receipt |
| Parent | Receipt row | Toast “Receipt RCPT-… shared” |
| Exams | Term chips | Crossfade data; non-midterm shows published-date empty |
| Admin | Search/filter | Instant filter by name/adm/parent; no-results state |
| Admin | Student row | Detail sheet with tabs; call/message toasts |
| Admin | Approvals | Approve/decline actions with toast + badge decrement |
| Inbox | Filter chips | Filter list; empty state per filter |
| Inbox | Mark all read | Clear dots, unread 0, toast |
| Profile | Appearance | Light/Dark/System; System follows media query |
| Profile | Role tiles | Confirm sheet → switch nav + home + toast |
| Profile | Sign out | Confirm sheet → login, clear inputs, toast |
| Global | Back | Pop stack; Esc closes sheet first |
| Dev | Long-press logo 5s | Dev panel: GPS cycle, payment fail/success, reduce motion, reset |

No dead buttons: if a real flow is out of demo scope (e.g., Call), show a precise toast (“Calling Ramesh Reddy…” / “PDF saved to Downloads”), never silence.

### 8.7 Keyboard, focus, and a11y implementation

- Use native `<button>` for every control; `<a href="#">` only for inline links with `preventDefault`.
- Roving tabindex for chips/segmented controls; ArrowLeft/Right changes selection, Home/End jump.
- Sheet: `role="dialog" aria-modal="true" aria-labelledby="sheet-title"`; on open, save `document.activeElement`; focus `[data-autofocus]`; Tab cycles only inside; Esc/backdrop closes; restore focus. Underlying app gets `inert` (or `aria-hidden`) while open.
- `aria-live="polite"` for toasts and status text; success announced once via a dedicated `role="status"` region.
- Set `lang="en-IN"`; format currency with `Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0})` (output `₹18,500`).
- Image-free avatars use initials with `aria-hidden` when the adjacent name is visible.
- Test with keyboard only, 200% zoom, and reduced motion; axe DevTools zero critical issues.

### 8.8 Build order (suggested, keeps file small)

1. Tokens + reset + stage/phone + status bar (~250 lines CSS).
2. Shared components CSS: buttons, fields, chips, cards, rows, tiles, badges, nav, app bar, sheet, toast, skeleton, ring (~700 lines).
3. SVG sprite + icon helper (~180 lines).
4. `DATA` object (~180 lines).
5. Render helpers (`el`, `money`, `icon`, `appBar`, `nav`, `row`) + 12 screen templates (~1100 lines).
6. Sheets (8 types) + toasts + confetti + event delegation + state machine (~800 lines).
7. Focus/a11y/keyboard + persistence + dev panel (~250 lines).
Target total ~3400–3800 lines; keep under 4000.

### 8.9 Definition of done

- All 12 screens reachable in both themes and all 4 roles (accountant aliases documented).
- Every button/chip/toggle/nav item performs its mapped action; no dead ends.
- Payment, check-in, homework, role switch, sign-out and sheet flows complete end-to-end with success/failure paths.
- Empty, loading (skeleton), error, disabled and success states exist for every data screen.
- 390×844 frame with no clipping/overflow; 44pt targets; focus rings visible; Esc closes sheets; keyboard-only pass.
- Reduced motion removes confetti/shimmer/slide/stagger; dark mode has no white flashes or unreadable text.
- File is self-contained, opens `file://`, under 4000 lines, no emoji, no external requests.

# **Sploot — aesthetics.md**

> Design language for **Sploot**: a private, fast, text→image meme library.
> Primary direction: **Crisp Lab Minimal** (dark-first) with optional **Bento Modern** variant.

---

## 1) Brand Pillars

1. **Playfully sharp:** fun content, crisp interface.
2. **Private lab:** personal vault, calm tone.
3. **Fast & unfussy:** one search, instant results.
4. **Delight in small moments:** subtle motion, tactile feedback.

---

## 2) Identity — Wordmark, Glyph, Usage

### 2.1 Wordmark

* Lowercase `sploot`, rounded terminals.
* Slightly increased tracking (+1–2%).
* Prefer solid single-color (use `--accent` or `--text` depending on surface).

### 2.2 Glyph (icon)

* **Tag Dot**: the second “o” becomes a tilted lozenge (tag).
* Works as favicon and PWA icon center motif.

### 2.3 Safe Areas & Minimums

* Clear space = height of the “p” stem on all sides.
* Minimum sizes:

  * Favicon 32×32 px
  * PWA maskable 192–512 px
  * App header wordmark ≥ 20 px cap height

### 2.4 Don’ts

* Don’t stretch, skew, or apply heavy textures.
* Don’t place `accent` wordmark on `accent` surfaces.
* Don’t outline the wordmark unless on photographic backgrounds (1 px hairline only).

---

## 3) Color System

### 3.1 Roles (dark-first)

* `bg` — app background
* `surface` — cards, panels
* `surfaceMuted` — inputs, muted chips
* `text` — primary text
* `mutedText` — secondary text
* `accent` — primary interactive/brand
* `accentAlt` — supportive pop for micro-moments
* `danger`, `warning`, `success` — system states
* `border` — hairline outlines

### 3.2 Palette — **Crisp Lab Minimal (dark)**

* `bg`: **#0B0C0E**
* `surface`: **#14171A**
* `surfaceMuted`: **#1B1F24**
* `text`: **#E6E8EB**
* `mutedText`: **#B3B7BE**
* `border`: **#2A2F37**
* `accent`: **#7C5CFF** (Neon Violet)
* `accentAlt`: **#B6FF6E** (Lime Pop)
* `danger`: **#FF4D4D**
* `warning`: **#FFB020**
* `success`: **#22C55E**

### 3.3 Light Mode Pair

* `bg`: **#FFFFFF**
* `surface`: **#F5F7FA**
* `surfaceMuted`: **#ECEFF3**
* `text`: **#111417**
* `mutedText`: **#5A616A**
* `border`: **#D5DAE0**
* `accent`: **#6A4CFF**
* `accentAlt`: **#8FE85E**

### 3.4 Optional Variant — **Bento Modern**

* `accent`: **#5B8CFF**, `accentAlt`: **#9EF0D1**
* Keep neutrals identical; only swap accents.

### 3.5 Contrast

* Body text ≥ **4.5:1** against surfaces.
* Small UI labels ≥ **3:1** minimum.

---

## 4) Typography

### 4.1 Families

* **Primary UI:** Geist Sans (or Inter fallback).
* **Code/micro:** JetBrains Mono (tiny labels, optional).

### 4.2 Scale (px / line-height)

* Display **32 / 40**
* H1 **24 / 32**
* H2 **20 / 28**
* Body **14 / 22**
* Small **12 / 18**

### 4.3 Letterspacing

* Wordmark & search input: **+1–2%** tracking.
* Body: default tracking (optical), no justification.

### 4.4 Usage

* Headlines: medium/semi-bold.
* Buttons: medium; avoid all caps; Title Case optional.

---

## 5) Layout, Spacing, Shape

### 5.1 Grid & Spacing

* Base unit: **8 px**.
* Key steps: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
* Masonry grid with consistent **card width** and variable height.

### 5.2 Radii

* `radius-xs: 6`
* `radius-sm: 10`
* `radius-md: 14`
* `radius-lg: 20`
* `radius-xl: 24`
* **Cards:** use `radius-2xl: 28`.

### 5.3 Elevation

* Default: border-only (`--border`).
* Hover: `shadow-xs` (2 px blur, low opacity).
* Active modals: `shadow-sm` (8–12 px blur).

---

## 6) Components (styling motifs)

### 6.1 Search Bar (hero element)

* Height **48–56 px**, pill shape.
* Left **side stripe**: 2–4 px in `accent`.
* Focus: inner glow + subtle 1–2 px outline in `accent`.

### 6.2 Tags & Filters

* Pills with hairline border (`--border`), muted surface background.
* Active: solid `--accent` with `--text` inverted.

### 6.3 Cards (image tiles)

* Rounded-2xl, border hairline, no heavy shadows.
* Hover: lift by 2 px; quick actions slide/fade in 60 ms.
* Overlay row: chips (tags), ★ favorite.

### 6.4 Buttons

* **Primary:** solid `accent`; hover darken 6–8%.
* **Secondary:** surface with border; hover elevate.
* **Tertiary:** text-only; underline on hover.

### 6.5 Toasts

* Bottom-center; pill; single line or two max; icon + text; auto-dismiss 3–4 s.

---

## 7) Motion & Feedback

### 7.1 Durations & Easing

* Enter/exit: **140–180 ms**.
* Micro-feedback: **120–160 ms**.
* Easing: **cubic-bezier(0.2, 0.8, 0.2, 1)** (standard) and **(0.34, 1.56, 0.64, 1)** for small pops.

### 7.2 Moments

* **Search focus:** expand + glow (120–160 ms).
* **Tile hover:** lift 2 px + shadow-xs.
* **Favorite:** tiny pop; confetti-2 dots in `accentAlt`.
* **Upload complete:** checkmark path draw (\~200 ms) + image crossfade/1.02× zoom.

### 7.3 Reduced Motion

* Honor `prefers-reduced-motion`: disable lifts/zooms; keep opacity-only fades.

---

## 8) Accessibility

1. Keyboard: visible focus ring (2 px) in `accent`.
2. Hit targets ≥ **40×40 px** on mobile.
3. Never rely on color alone for state; include icons/labels.
4. Ensure semantic HTML (lists, buttons, labels/inputs).

---

## 9) Imagery & Content

* **Memes are content, UI is frame.** Keep chrome quiet.
* Avoid heavy overlays that obscure images.
* Empty states: minimal illustration or icon; no noisy patterns.
* NSFW controls are a filter (if added later), not a theme.

---

## 10) Voice & Microcopy

* **Tone:** dry, understated, a little meta.
* Samples:

  * Empty search: “no vibes matched—try ‘more zoomer’.”
  * Upload success: “splooted.”
  * Favorite: “starred for future chaos.”
  * Error: “that didn’t land—try again.”

---

## 11) Implementation Tokens

### 11.1 CSS Variables

```css
:root[data-theme="sploot-dark"] {
  --bg: #0B0C0E;
  --surface: #14171A;
  --surfaceMuted: #1B1F24;
  --text: #E6E8EB;
  --mutedText: #B3B7BE;
  --border: #2A2F37;
  --accent: #7C5CFF;
  --accentAlt: #B6FF6E;
  --danger: #FF4D4D;
  --warning: #FFB020;
  --success: #22C55E;

  --radius-xs: 6px; --radius-sm: 10px; --radius-md: 14px;
  --radius-lg: 20px; --radius-xl: 24px; --radius-2xl: 28px;

  --shadow-xs: 0 2px 6px rgba(0,0,0,0.25);
  --shadow-sm: 0 8px 24px rgba(0,0,0,0.35);
}

:root[data-theme="sploot-light"] {
  --bg: #FFFFFF; --surface: #F5F7FA; --surfaceMuted: #ECEFF3;
  --text: #111417; --mutedText: #5A616A; --border: #D5DAE0;
  --accent: #6A4CFF; --accentAlt: #8FE85E;
}
```

### 11.2 Tailwind (excerpt)

```js
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surfaceMuted: 'var(--surfaceMuted)',
        text: 'var(--text)',
        mutedText: 'var(--mutedText)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        accentAlt: 'var(--accentAlt)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        success: 'var(--success)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
      },
    }
  }
}
```

### 11.3 Focus Ring utility

```css
.focus-ring {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

---

## 12) Logo Starter (SVG — wordmark+tag)

```svg
<svg width="320" height="80" viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg">
  <g fill="currentColor">
    <!-- Simple rounded wordmark (placeholder shapes) -->
    <text x="10" y="55" font-family="Geist, Inter, system-ui" font-size="44" letter-spacing="0.02em">
      spl<span>o</span>ot
    </text>
    <!-- Tag Dot replacing the second 'o' -->
    <rect x="198" y="32" rx="6" ry="6" width="18" height="12" transform="rotate(-12 207 38)"/>
  </g>
</svg>
```

> Replace with final curves once lettering is approved; keep single color for easy theming.

---

## 13) Icon & Favicon Deliverables

* **Favicon:** 16, 32, 48 px (ICO)
* **PWA maskable:** 192, 256, 384, 512 px (PNG, safe area 80%)
* **Monochrome SVG** app icon (glyph only)
* **Wordmark SVG** (horizontal)

---

## 14) QA Checklist (visual)

1. Wordmark legible at 20 px cap height on both themes.
2. Search bar focus ring visible at 100% and 75% brightness.
3. Contrast checks pass (body, labels, outline on surfaces).
4. Motion reduced mode disables lifts/zooms.
5. Accent swap (Bento variant) doesn’t break focus states or tags.

---

## 15) Do / Don’t (quick)

**Do**

* Keep chrome minimal; let images dominate.
* Use hairline borders to define structure.
* Use `accentAlt` sparingly for micro-joy (favorites, confetti).

**Don’t**

* Add heavy gradients/noise to core UI.
* Mix more than two accent colors at once.
* Outline text over `surface` unless necessary for contrast.

---

## 16) Future Hooks

* **Theme switcher:** toggle `data-theme` and swap accent pair.
* **Alt identity:** Bento Modern accents for seasonal themes.
* **Illustration pack:** 3 micro-illustrations for empty states (monoline, 2 colors).

---

**Status:** v1 approved design language.
**Next:** finalize wordmark curves, export icon set, wire UI components with tokens.


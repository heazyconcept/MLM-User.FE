# Design System

**MLM User Frontend – Visual language and design tokens.**

This document describes the existing visual language: tokens, colors, typography, spacing, shadows, and border radii used across the application.

---

## 1. Design tokens overview

Tokens are defined in three places and must stay in sync:

| Source | Purpose |
|--------|---------|
| `mlm-user.fe/tailwind.config.js` | Tailwind utility classes, theme extension |
| `mlm-user.fe/src/styles.css` | CSS custom properties (`@theme`, `:root`) for Tailwind v4 and global CSS |
| `mlm-user.fe/src/app/app.config.ts` | PrimeNG Aura preset override (semantic primary scale) |

Use **Tailwind classes** in components (e.g. `bg-mlm-primary`, `text-mlm-warm-700`). Avoid hardcoding hex values in templates or component styles.

---

## 2. Colors

### 2.1 Brand palette

| Token | Hex | Usage |
|-------|-----|--------|
| `mlm-primary` / `brand-green-primary` | `#49A321` | Primary actions, links, key UI |
| `brand-green-light` | `#DCEDC8` | Light backgrounds, success highlights |
| `brand-green-dark` | `#1B5E20` | Dark accents, headings on light green |
| `brand-gold` | `#F9A825` | Accents, badges, rewards |
| `mlm-secondary` | `#64748b` | Secondary text, muted UI |

### 2.2 Semantic colors

| Token | Hex | Usage |
|-------|-----|--------|
| `mlm-success` | `#22c55e` | Success states, confirmations |
| `mlm-error` | `#ef4444` | Errors, destructive actions |
| `mlm-warning` | `#f59e0b` | Warnings, caution |
| `mlm-background` | `#f8fafc` | Page/surface background |
| `mlm-text` | `#000000` | Primary text (body) |

### 2.3 Color scales

- **mlm-green** (50–900): Primary green scale; 500 = primary, 700 = dark.
- **mlm-warm** (50–900): Warm neutrals for text and surfaces (stone-like).
- **mlm-teal** (50–900): Accent scale; use for secondary accents and charts.
- **mlm-blue** (50–900): Info, links, secondary actions.
- **mlm-red** (50–900): Errors, destructive actions, alerts.

Tailwind usage examples: `bg-mlm-green-100`, `text-mlm-warm-700`, `border-mlm-teal-300`.

### 2.4 PrimeNG semantic primary

PrimeNG Aura preset overrides the primary palette to align with brand green (see `app.config.ts`). Primary 500 = `#49A321`; full scale 50–950 is defined for components (buttons, inputs, etc.).

---

## 3. Typography

### 3.1 Font families

| Name | Tailwind / CSS | Usage |
|------|----------------|--------|
| Geist | `font-geist` / `'Geist', sans-serif` | Default body; loaded from Google Fonts |
| Outfit | `font-outfit` | Optional display/headings |
| Poppins | `font-poppins` | Optional alternate UI |

Loaded in `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Outfit:wght@100..900&family=Poppins:..." rel="stylesheet" />
```

Global default: `body { font-family: 'Geist', sans-serif; }`.

### 3.2 Scale and usage

Use Tailwind’s default type scale unless a token is added later:

- Headings: `text-xl`, `text-2xl`, `text-3xl`, etc.
- Body: `text-base`
- Small / captions: `text-sm`, `text-xs`
- Weights: `font-normal`, `font-medium`, `font-semibold`, `font-bold`

Prefer **mlm-warm** for text (e.g. `text-mlm-warm-900` for primary text, `text-mlm-warm-600` for secondary).

---

## 4. Spacing

Use Tailwind’s default spacing scale (4px base): `p-2`, `p-4`, `m-4`, `gap-4`, `space-y-4`, etc.

No project-specific spacing tokens are defined; stick to Tailwind utilities (e.g. `4`, `6`, `8` for 16px, 24px, 32px) for consistency.

---

## 5. Shadows

No custom shadow tokens are defined. Use Tailwind defaults:

- `shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`
- Card/panel: typically `shadow-sm` or `shadow`

---

## 6. Border radii

No custom radius tokens. Use Tailwind defaults:

- `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`
- Buttons/cards: `rounded-lg` or `rounded-md` for consistency with PrimeNG.

---

## 7. Dark mode

- **Tailwind:** `darkMode: 'selector'` — dark styles apply when an ancestor has class `.dark`.
- **PrimeNG:** `darkModeSelector: '.dark'` in app config.
- Color usage: Prefer semantic tokens and Tailwind dark variants (e.g. `dark:bg-mlm-warm-800`) when implementing dark theme.

---

## 8. Summary checklist

- Use **Tailwind classes** only; no hardcoded colors in components.
- Prefer **mlm-*** and **brand-*** tokens from `tailwind.config.js` and `styles.css`.
- Body font: **Geist**; optional **Outfit** / **Poppins** for variety.
- Spacing/shadows/radii: **Tailwind defaults** until project-specific tokens are added.
- Keep **PrimeNG preset** in `app.config.ts` aligned with `mlm-primary` for form controls and buttons.

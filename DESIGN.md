# ProTrack — Design System

> Design language for the Pertamina Foundation project-monitoring dashboard (ProTrack).
> Adapted from Apple's web design discipline — **restraint, a single accent, tight typography, near-invisible chrome, exactly one shadow** — retuned for a **data-dense dashboard** rather than a marketing gallery.

**Design read:** internal project-monitoring dashboard for program/project staff, with a *calm, trust-first, information-first* language, leaning toward Tailwind utilities + Inter + slate neutrals + a single Action Blue accent. `VARIANCE 3 · MOTION 3 · DENSITY 6`. This is a cockpit, not a museum — but it borrows the museum's restraint.

**Stack it lives in:** React 18 + Vite + TypeScript, Tailwind (CDN), `lucide-react` icons, `recharts` + `chart.js` for data-viz, Supabase backend. All tokens below are expressed as **hex + the Tailwind class** to use, because the project styles with Tailwind utility classes, not a token file.

---

## 0. The One Rule

**One accent. Everything interactive is Action Blue. Everything else is slate.**

The single hardest thing to keep is color discipline. Today the codebase mixes `emerald` (active nav), `indigo` (stat icons), and `blue` (theme) as if all three were the brand. They are not. From now on:

- **Action Blue** = the *only* "this is interactive / this is selected / click me" color.
- **Slate** = every neutral surface, border, and text tone.
- **Emerald / Amber / Red** = *semantic status only* (on-track / at-risk / late). Never used as decoration, never as a brand accent, never on a button that isn't communicating status.

If a color isn't carrying interactivity or status meaning, it's slate.

---

## 1. Principles (adapted from Apple)

| Apple principle | How it translates to this dashboard |
|---|---|
| Photography-first; UI recedes | **Data-first.** The chart, the number, the table row is the hero. Chrome (cards, borders, toolbars) stays quiet so the data reads. |
| Single blue accent carries every interaction | **Action Blue** (`#0066cc`) is the only interactive color. Selected nav, primary buttons, links, focus rings, active tabs, the "current" series in a chart. |
| Alternating full-bleed tiles as rhythm | **Section bands, not tiles.** Group a dashboard into calm horizontal sections separated by whitespace or a single hairline — never by boxing everything in nested cards. |
| Exactly one drop-shadow, on product imagery | **One card shadow, barely there.** `shadow-sm` at rest. Elevation comes from surface + hairline, not stacked shadows. No shadow on buttons, badges, inputs, or text. |
| SF Pro tight tracking at display sizes | **Inter with negative tracking on headings** (`tracking-tight` / `tracking-tighter`). Numbers and titles feel deliberate, not loose. |
| Whitespace is the product's pedestal | **Let numbers breathe.** A KPI needs air around it more than it needs a border. Density comes from *organization*, not from cramming. |
| Radius grammar: pill / lg / sm, nothing in between | **Fixed radius scale.** `rounded-full` for pills & avatars, `rounded-xl` for cards, `rounded-lg` for controls, `rounded-md` for inline chips. Pick from the scale; never freestyle. |
| `scale(0.95)` press on every button | **Tactile press** on every interactive element: `active:scale-[0.98]`. |

**What we deliberately do NOT borrow from Apple:** full-bleed alternating black tiles, 56px hero headlines, marketing copy, product-render shadows, weight-300 airy type. Those serve a catalog. A dashboard needs legibility at 14–17px and stable, scannable structure.

---

## 2. Color

### 2.1 Accent — Action Blue (the only brand-interactive color)

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| `action` | `#0066cc` | `bg-[#0066cc]` / `text-[#0066cc]` | Primary buttons, selected state, key links, active tab, focused chart series |
| `action-hover` | `#0055b3` | `hover:bg-[#0055b3]` | Primary button hover |
| `action-focus` | `#0071e3` | `ring-[#0071e3]` | Focus ring (2px) |
| `action-on-dark` | `#2997ff` | `text-[#2997ff]` | Links/accents on a slate-900 surface (dark sidebar, dark chart tooltip) — Action Blue disappears on dark |
| `action-tint` | `#eff6ff` | `bg-blue-50` | Selected-row tint, active-nav background, info banner fill |
| `action-tint-border` | `#bfdbfe` | `border-blue-200` | Border on tinted/selected surfaces |

> Practical note: if you'd rather stay on Tailwind's ramp than use arbitrary hex, `blue-600` (`#2563eb`) is the nearest swap for `action` and `blue-700` for `action-hover`. Pick one and be consistent across the whole app — do not mix `#0066cc` and `blue-600` on the same screen.

### 2.2 Neutral — Slate (every surface, border, and text tone)

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| `canvas` | `#f8fafc` | `bg-slate-50` | App background (already set on `<body>`) |
| `surface` | `#ffffff` | `bg-white` | Cards, panels, table rows, inputs |
| `surface-sunken` | `#f1f5f9` | `bg-slate-100` | Table header, inset wells, hover rows, chips |
| `hairline` | `#e2e8f0` | `border-slate-200` | The default 1px border on everything (your most-used class — keep it) |
| `hairline-strong` | `#cbd5e1` | `border-slate-300` | Emphasis border, input border on focus-adjacent |
| `ink` | `#0f172a` | `text-slate-900` | Headlines, KPI numbers, primary values |
| `ink-body` | `#334155` | `text-slate-700` | Body text, table cells |
| `ink-muted` | `#64748b` | `text-slate-500` | Labels, captions, secondary metadata |
| `ink-faint` | `#94a3b8` | `text-slate-400` | Icons at rest, placeholder, disabled |
| `sidebar-dark` | `#0f172a` | `bg-slate-900` | Optional dark sidebar / dark chart tooltips |

### 2.3 Semantic status (meaning only — never decoration)

Dashboards must signal state; Apple's marketing pages don't. This is the one place we add color beyond the accent — but strictly as **encoded meaning**, always paired with an icon or label so it survives color-blindness and grayscale printing (this app exports PDFs).

| Status | Hex | Tailwind (text / fill / border) | Meaning |
|---|---|---|---|
| **Positive / On-track / Ahead** | `#059669` | `text-emerald-600` · `bg-emerald-50` · `border-emerald-200` | Progress ≥ plan, approved, active, positive trend |
| **Warning / At-risk / Pending** | `#d97706` | `text-amber-600` · `bg-amber-50` · `border-amber-200` | Behind but recoverable, awaiting action, expiring soon |
| **Danger / Late / Rejected** | `#dc2626` | `text-red-600` · `bg-red-50` · `border-red-200` | Overdue, blocked, rejected, negative trend |
| **Neutral / Draft / N/A** | `#475569` | `text-slate-600` · `bg-slate-100` · `border-slate-200` | Not started, draft, informational |

> **The emerald migration.** Emerald is being *demoted* from "second brand color" to "positive-status only." Active navigation, selected states, and primary buttons that are currently emerald move to **Action Blue**. Emerald stays only where it means *good/on-track/approved*.

### 2.4 Data-visualization palette

Charts (`recharts`, `chart.js`) need a categorical series ramp. Anchor series 1 to the accent; keep the rest muted and distinguishable, not rainbow.

| Series | Hex | Role |
|---|---|---|
| Series 1 (primary / actual) | `#0066cc` | The main line — Action Blue, always the focus |
| Series 2 (plan / baseline) | `#94a3b8` | Slate — the reference line, deliberately quiet |
| Series 3 | `#059669` | Emerald |
| Series 4 | `#d97706` | Amber |
| Series 5 | `#7c3aed` | Violet |
| Series 6 | `#0891b2` | Cyan |
| Grid lines | `#e2e8f0` | `slate-200` — hairline weight |
| Axis labels | `#64748b` | `slate-500` |

**S-Curve rule:** *actual* is Action Blue and solid; *plan* is slate and dashed. The eye should land on actual-vs-plan instantly. Fill areas at ≤10% opacity or not at all.

---

## 3. Typography

Font is **Inter** (already loaded), the standard, legible substitute for SF Pro on non-Apple platforms. `Poppins` is loaded but should be **retired for UI** — one type family keeps the system coherent (Apple uses one). Reserve Poppins, if at all, for a logotype only.

**The Apple move, adapted:** negative letter-spacing on everything display-sized; body stays comfortable and unfussy. Weight ladder is `400 / 500 / 600 / 700` — use `600` for headings, not `700`, except where real assertion is needed.

| Role | Size / Tailwind | Weight | Tracking | Use |
|---|---|---|---|---|
| Page title | `text-2xl` (24px) | `font-semibold` | `tracking-tight` | Page/section H1 |
| Card / panel title | `text-lg` (18px) | `font-semibold` | `tracking-tight` | Card headers |
| **KPI number** | `text-3xl` (30px) | `font-bold` | `tracking-tight` | The big stat — the closest thing to an Apple headline |
| Section label | `text-sm` (14px) | `font-semibold` | `tracking-tight` | Stat labels, group headers, table headers |
| Body | `text-sm`–`text-base` (14–16px) | `font-normal` | default | Table cells, descriptions |
| Caption / meta | `text-xs` (12px) | `font-normal`/`medium` | default | Timestamps, helper text, footnotes |
| Numeric (tabular) | any | + `tabular-nums` | — | **Always** on figures in tables/KPIs so digits align |

**Rules**
- `tracking-tight` on every heading and KPI. This is the single biggest "feels considered" lever. Never track-tight below 14px.
- **`tabular-nums` on all data figures.** Non-negotiable in a monitoring tool — misaligned digits read as sloppy.
- Weight `500` (`font-medium`) is fine here for UI emphasis (unlike Apple, which bans 500) — a dashboard has more UI states than a poster. But headings settle on `600`.
- One family. Inter for everything. Kill Poppins in UI.

---

## 4. Spacing & Layout

Base unit **4px**; structural rhythm on **8 / 12 / 16 / 24**.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `xs` | 8px | `gap-2` / `p-2` | Icon-to-label, chip padding |
| `sm` | 12px | `gap-3` / `p-3` | Compact controls |
| `md` | 16px | `gap-4` / `p-4` | Card padding (mobile), grid gaps |
| `lg` | 24px | `gap-6` / `p-6` | Card padding (desktop), section internal |
| `xl` | 32px | `gap-8` | Between major dashboard blocks |
| `section` | 48px | `mb-12` | Between top-level page sections |

**Layout**
- App shell: fixed sidebar (`w-64`, collapsible to `w-20`) + scrolling content — already built in `Layout.tsx`, keep it.
- Content max width for reading-heavy pages: `max-w-7xl mx-auto`. Dashboards with wide tables/charts may go full-width with `px-4 sm:px-6`.
- **Grid, not flex-math.** KPI rows: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`. Never `w-[calc(...)]`.
- **Whitespace over borders.** Prefer a 24px gap between two groups over wrapping each in its own bordered card. Nested cards (card-in-card-in-card) are banned — a KPI on a plain section reads cleaner than a KPI boxed twice.

---

## 5. Shape & Radius

One fixed scale. Mixing radii is the fastest way to look unfinished.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `pill` | 9999px | `rounded-full` | Status badges, avatars, filter chips, icon buttons, toggle |
| `card` | 12px | `rounded-xl` | Cards, panels, modals, KPI tiles |
| `control` | 8px | `rounded-lg` | Buttons, inputs, selects, dropdowns |
| `chip` | 6px | `rounded-md` | Inline tags, table-cell chips, small badges |

Rule: **pill for anything status/identity-shaped, `rounded-xl` for containers, `rounded-lg` for controls.** Nothing in between. (This matches Apple's "pick from the scale" discipline; the values differ because a dense UI reads better slightly softer than Apple's marketing 18px cards.)

---

## 6. Elevation & Depth

Apple ships **one** shadow. We allow **two**, both whisper-soft, tinted toward slate — never pure-black.

| Level | Treatment | Tailwind | Use |
|---|---|---|---|
| Flat | none | — | Table rows, sidebar, inline content, sections |
| Resting card | 1px hairline + faint shadow | `border border-slate-200 shadow-sm` | KPI cards, panels — **the default** |
| Floating | slightly stronger, still soft | `shadow-lg` | Modals, dropdown menus, popovers, mobile drawer |

**Shadow philosophy**
- Elevation is communicated by **surface + hairline first**, shadow second. A card is a card because of its border and white fill, not because it floats.
- **No shadow on:** buttons, badges, inputs, tabs, text, chart bars.
- No `shadow-md` "hover lift" as decoration. If hover feedback is needed, tighten the border (`hover:border-slate-300`) — cheaper and calmer than a shadow bump. (The current `StatCard` `hover:shadow-md` should soften to a border change.)

---

## 7. Components

All specs assume the tokens above. Icons: **`lucide-react` only**, one family, `strokeWidth={2}`, size `16`–`20` in UI, `size={14}` inside badges.

### 7.1 Buttons

**Primary** — the single most important action on a view.
```
bg-[#0066cc] text-white text-sm font-semibold rounded-lg px-4 py-2.5
hover:bg-[#0055b3] active:scale-[0.98] transition
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2
disabled:bg-slate-200 disabled:text-slate-400
```

**Secondary** — the ghost/second action.
```
bg-white text-slate-700 text-sm font-medium rounded-lg px-4 py-2.5
border border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition
```

**Tertiary / text link** — Action Blue text, no fill: `text-[#0066cc] font-medium hover:underline`. On dark surfaces use `text-[#2997ff]`.

**Danger** — destructive only (delete, reject): `bg-red-600 text-white hover:bg-red-700`. Never for ordinary actions.

**Icon button** — `rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100`.

Rules: **one primary button per view.** `active:scale-[0.98]` on all. Label ≤ 3 words, one line, never wraps. Every button passes 4.5:1 contrast.

### 7.2 Sidebar navigation (`Layout.tsx`)

The active item is the clearest place the accent migration shows.

- **Active:** `bg-blue-50 text-[#0066cc] font-medium` with the icon in `text-[#0066cc]`. *(Currently emerald — migrate to blue.)*
- **Rest:** `text-slate-600 hover:bg-slate-100 hover:text-slate-900`, icon `text-slate-400`.
- Item: `rounded-lg px-3 py-2.5 gap-3`. Collapsed: center the icon, hide the label.
- Sidebar surface `bg-white border-r border-slate-200`; header hairline `border-slate-200`.

### 7.3 KPI / Stat card (`StatCard.tsx`)

The dashboard's version of Apple's product tile — the number is the hero.

```
Container:  bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6
            hover:border-slate-300 transition   ← border change, NOT shadow bump
Label:      text-sm font-semibold tracking-tight text-slate-500
Value:      text-3xl font-bold tracking-tight text-slate-900 tabular-nums
Icon chip:  p-2 rounded-lg bg-blue-50 text-[#0066cc]   ← was indigo; migrate to blue
Trend +:    text-emerald-700 bg-emerald-100  (positive = semantic emerald, correct)
Trend −:    text-red-700 bg-red-100
Trend 0:    text-slate-600 bg-slate-100
Trend pill: rounded-full px-2 py-0.5 text-xs font-medium
```
Change from current: icon chip `indigo → blue`, and drop `hover:shadow-md` in favor of the border hover. Trend colors are already semantically correct — keep them.

### 7.4 Status badge

Pill, icon + label, always. This is where semantic color lives.
```
inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium
On-track:  bg-emerald-50 text-emerald-700 border border-emerald-200
At-risk:   bg-amber-50   text-amber-700   border border-amber-200
Late:      bg-red-50     text-red-700     border border-red-200
Draft:     bg-slate-100  text-slate-600   border border-slate-200
```
Never encode status by color alone — pair with a lucide glyph (`CheckCircle2`, `AlertTriangle`, `XCircle`, `Circle`) so it reads in the PDF exports and for color-blind users.

### 7.5 Data table

The densest surface — restraint matters most here.
- Header: `bg-slate-50 text-xs font-semibold tracking-tight text-slate-500 uppercase` (tracking-tight, not wide — this is the one place a small caps label is earned, and it's functional).
- Rows: `border-b border-slate-100`, `hover:bg-slate-50`. Selected row: `bg-blue-50`.
- Numbers right-aligned + `tabular-nums`. Text left-aligned.
- **No vertical gridlines, no zebra striping.** Horizontal hairlines only — the Apple "let the content divide itself" move.
- Sticky header on scroll for long tables; horizontal scroll uses the existing `.custom-scrollbar`.

### 7.6 Inputs & forms

```
Input:  bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-400
        focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/30 focus:outline-none
Label:  text-sm font-medium text-slate-700 mb-1.5   (ABOVE the input, always)
Helper: text-xs text-slate-500 (below)
Error:  text-xs text-red-600 (below) + input border-red-400
```
Rules: label above the input, never placeholder-as-label. Focus ring is Action Blue. Search input may be `rounded-full` (matches the pill grammar) with a leading `Search` glyph.

### 7.7 Tabs / segmented controls

- Active tab: `text-[#0066cc]` with a 2px `border-b-2 border-[#0066cc]` underline (underline tabs), or `bg-white shadow-sm text-slate-900` inside a `bg-slate-100 rounded-lg` segmented track.
- Inactive: `text-slate-500 hover:text-slate-700`.

### 7.8 Modal / dropdown

- Modal: `bg-white rounded-xl shadow-lg`, backdrop `bg-slate-900/50 backdrop-blur-sm` (already used for the mobile menu — reuse it).
- Dropdown/menu: `bg-white border border-slate-200 rounded-lg shadow-lg`, items `hover:bg-slate-50`, selected `text-[#0066cc]`.

---

## 8. Motion

`MOTION 3` — motion confirms actions and eases transitions; it never performs.

- **Press:** `active:scale-[0.98]` on all interactive elements (the Apple micro-interaction, softened).
- **Transitions:** `transition` / `transition-colors` at `duration-200`. Sidebar collapse `duration-300`.
- **Enter:** subtle only — `animate-in fade-in slide-in-from-bottom-2 duration-300` for cards/panels appearing. Keep the existing `animations.css`; prune anything longer than ~500ms.
- **Respect `prefers-reduced-motion`** — gate entrance animations behind it.
- No infinite loops, no decorative float/pulse, no parallax. A monitoring tool must feel stable and instant.

---

## 9. Do / Don't

**Do**
- Use Action Blue for *every* interactive/selected element, and nothing else.
- Use emerald/amber/red *only* as status, always with an icon or label.
- Put `tracking-tight` on headings & KPI numbers, `tabular-nums` on all figures.
- Separate sections with whitespace or a single hairline before reaching for a card.
- Keep exactly one primary button per view.
- `active:scale-[0.98]` on everything clickable.
- Keep slate as the only neutral family.

**Don't**
- Don't reintroduce indigo, or use emerald for selection/branding/active-nav.
- Don't nest cards inside cards inside cards — flatten with spacing.
- Don't add shadows to buttons, badges, inputs, or as hover decoration.
- Don't mix radii off the scale, or box every number in its own border.
- Don't use Poppins in the UI, or a second UI font.
- Don't encode status by color alone (PDF export + a11y).
- Don't rainbow a chart — Series 1 is Action Blue, the rest stay muted.
- Don't mix `#0066cc` and `blue-600` on the same screen — pick one hex source and lock it.

---

## 10. Migration checklist (current → target)

The audit found the accent split. Concrete swaps to converge on this system:

1. **Sidebar active state** emerald → Action Blue (`Layout.tsx`): `bg-emerald-50 text-emerald-700` → `bg-blue-50 text-[#0066cc]`.
2. **StatCard icon chip** indigo → blue (`StatCard.tsx`): `bg-indigo-50 text-indigo-600` → `bg-blue-50 text-[#0066cc]`; drop `hover:shadow-md`, keep `hover:border-slate-300`.
3. **Selection / focus rings** consolidate `ring-emerald-500` (selection) → `ring-[#0071e3]`. Keep emerald rings *only* where they mean "valid/approved."
4. **Primary buttons** any emerald-filled action buttons → Action Blue. Emerald-filled buttons remain only for "Approve/Confirm-positive" semantics.
5. **Retire Poppins** from component markup; remove the font `<link>` if nothing else uses it.
6. **`theme-color`** meta (`index.html`) `#1e40af` → `#0066cc` to match the accent.
7. **Chart series** standardize actual = `#0066cc` solid, plan = `#94a3b8` dashed across `SCurveChart`, `WorkSCurveChart`, `ProgressMetrics`.

Do these incrementally, screen by screen — each screen should be fully converged (no mixed accent) before moving on, per the color-consistency lock.

---

*This document is the source of truth for ProTrack's visual language. When a design decision isn't covered here, resolve it toward the nearest principle in §1 — and if it recurs, add it here.*

# 04 · UI craft for dense workbenches + mood board

Scope: how a V2 tool screen (API tester, SQL runner, WSJF, UAT tracker…) should look and behave so it is clear, demo-able and visibly *designed*. All contrast ratios below were computed (WCAG 2.x relative-luminance formula) on 2026-11-08, not estimated.

## 1. Sources (read)

| # | Source | What we took |
|---|---|---|
| S1 | https://linear.app/now/how-we-redesigned-the-linear-ui | LCH theme from 3 inputs (base, accent, contrast); elevation layers; Inter Display for headings; "inverted L" chrome |
| S2 | https://vercel.com/geist/colors | 10-step scale with a fixed job per step (bg / hover / active / border ×3 / solid ×2 / text ×2) |
| S3 | https://vercel.com/geist/typography | Label (single line, looser) vs Copy (multi-line) type roles; mono label sizes 12–14 |
| S4 | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale + `radix-ui/colors` src | 12-step scale semantics; hex values used below; step 11 ≈ APCA Lc 60, step 12 ≈ Lc 90 |
| S5 | https://stripe.com/blog/accessible-color-systems | Perceptual colour space; "5 steps apart = small-text safe, 4 apart = icons/large text"; text must pass on the lightest tint too |
| S6 | https://github.com/hoppscotch/hoppscotch | API tool anatomy: Auth / Headers / Params / Body / Pre-request / Tests; raw vs preview response; light/dark/black + 9 accents |
| S7 | https://docs.hoppscotch.io/documentation/getting-started/rest/creating-a-request | Method dropdown + URL + Send as one bar; response below |
| S8 | https://www.raycast.com/blog/a-fresh-look-and-feel | Bottom action bar showing shortcuts; ⌘K action menu; toasts inside the window |
| S9 | https://github.com/pacocoursey/cmdk | Command palette behaviour: fuzzy filter + keywords, groups, arrow loop, Esc/Backspace back, ⌘K/Ctrl+K wired manually |
| S10 | https://carbondesignsystem.com/components/data-table/style/ | Row heights 24/32/40/48/64 px; 16 px cell padding |
| S11 | https://carbondesignsystem.com/elements/motion/overview/ | Durations 70/110/150/240/400/700 ms; productive easing `cubic-bezier(0.2,0,0.38,0.9)` |
| S12 | https://www.nngroup.com/articles/data-tables/ | Freeze header + shadow; zebra/hover to keep place; ≤2 inline row actions, else batch |
| S13 | https://www.nngroup.com/articles/progress-indicators/ | <1 s nothing; 2–10 s spinner; ≥10 s percent-done; "3 of 50" for batches |
| S14 | https://www.nngroup.com/articles/toggle-switch-guidelines/ | Toggle = immediate binary; radios/segmented when applied on submit |
| S15 | https://design-system.service.gov.uk/components/error-message/ | Error after hint, red border, specific "Enter…" wording, summary at top uses same text |
| S16 | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 2.5.8: targets ≥ 24×24 CSS px or 24 px spacing circle |
| S17 | https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html | Focus ring ≥ 2 px perimeter with ≥ 3:1 change |
| S18 | https://www.w3.org/International/articles/article-text-size | Expansion: ≤10 chars 200–300 %, 11–20 chars 180–200 %, >70 chars ~130 % |
| S19 | https://rsms.me/inter/ | Inter OFL 1.1; `tnum`, `zero` (slashed 0), `ss02` disambiguation; text vs display optical sizes |
| S20 | https://lucide.dev/guide/ , https://lucide.dev/guide/lucide/getting-started | ISC, 1 600+ icons, UMD build + `lucide.createIcons()`; pin a version |
| S21 | https://supabase.com/design-system | Atoms → fragments (Code Block, Filter Bar, Metric Card) → patterns (Forms, Tables) layering |

## 2. Findings

**2.1 Hierarchy of a tool screen.** Every reference tool uses one shape: *command bar → inputs → results*. Hoppscotch/Postman put method + URL + **Send** on one line at the top, request config tabs beneath, response in a second pane (S6, S7). Linear frames content with fixed chrome on the left and top ("inverted L") so the work area is the largest rectangle (S1). Rule for V2: **top row = the 3–4 required inputs + primary action; left/top pane = configuration; right/bottom pane = results; the primary action is always visible without scrolling.** Results pane shows a meta strip first (status, time, size / rows, duration / score), then the body.

**2.2 Forms.** Label above field (scans fastest, survives +30 % FR expansion), hint under label, error under hint and the field turns red (S15). Error copy is an instruction: "Enter a URL starting with https://", never "Invalid input". Validate on blur and on submit, not per keystroke; on submit also show a summary at the top that links to each field (S15). Required inputs first; everything else behind a single **Advanced** disclosure that shows a count of non-default values ("Advanced · 2 set") so hidden state is never invisible.

**2.3 Split panes.** Horizontal split (request | response) at ≥1 200 px, vertical stack below. Draggable 6 px gutter with a 1 px visible line, `cursor: col-resize`, keyboard resizable (arrow keys, `role="separator"` with `aria-valuenow`), remember the ratio per tool in localStorage, min pane width 320 px.

**2.4 Tabs vs segmented controls.** *Tabs* switch **which panel** you see (Params / Headers / Body / Auth); they show a count badge when a panel holds data ("Headers 3"). *Segmented controls* change **a value** applied immediately to the current view (JSON / Raw / Preview; Visa EN / CB FR) (S14, Primer). More than 5 options → select. Never use a toggle switch for something applied only on Send (S14).

**2.5 Tables.** Densities: 32 px compact (SQL results, UAT list), 40 px default (S10). Hairline row separators + hover tint beat zebra for ≤ 8 columns; turn on zebra only for wide (≥ 8 columns) result grids where the eye must travel (S12). Numbers right-aligned with `font-variant-numeric: tabular-nums` (S19), text left, headers aligned with their data. Sticky header with shadow once scrolled (S12). ≤ 2 inline row actions; more → checkbox selection + toolbar (S12). Truncate with ellipsis + `title`, never wrap IDs/PANs.

**2.6 Code / JSON viewers.** Mono 12.5–13 px / 1.6. Line numbers in `--fg-3`, foldable objects/arrays (▸ with item count "{…} 4 keys"), copy button top-right, "Raw / Pretty" segmented, wrap toggle. Syntax colours drawn from the status scales (keys = accent text, strings = green text, numbers = amber text, booleans/null = red text, punctuation = `--fg-3`) so the viewer stays inside the palette. Large bodies (>200 KB) render raw with a notice instead of freezing.

**2.7 Empty, loading, error states.** Empty state = one sentence of what this area will show + the primary action + "Load sample" (the 60-second demo, GOAL principle 3). Loading per NN/g (S13): immediate pressed state; nothing under 1 s; inline spinner + elapsed timer ("Sending… 1.4 s") from 1 s; percent/“3 of 12” for batch runs (UAT, test suites). Errors stay in the result pane, never only in a toast.

**2.8 Toasts.** Only for confirmations of side effects ("Saved as test case · Undo"), bottom-right, 4 s (8 s with an action), max 1 visible, `role="status"` / `aria-live="polite"`, pause on hover. Raycast keeps toasts inside the window next to the action bar (S8) — same idea.

**2.9 Keyboard + command palette.** ⌘/Ctrl+K palette (S9): groups "Tools · Samples · Actions · Settings", fuzzy match with keywords (FR + EN synonyms so "rejeu" finds Chargeback), arrow loop, Enter runs, Esc closes. ⌘/Ctrl+Enter = primary action on every tool (Send, Run query, Compute). `?` opens a shortcut sheet. Show shortcuts inside buttons/menus as `<kbd>` (S8) so they are learned.

**2.10 Accessibility (WCAG 2.2 AA).** Text 4.5:1, UI boundaries/icons 3:1, focus ring 2 px with 3:1 change (S17), targets ≥ 24×24 px (S16); status never by colour alone (icon + text "200 OK", "✓ Pass"). Audit of V1 tokens: `--faint #9a9ea8` on `#fcfcfd` = **2.62:1** (fails, yet used for counts/dates); dark `--faint #5f636c` on `#0b0c0e` = 3.25:1 (fails); `.err #d6493f` = 4.30:1 (fails); `--line-strong #d6d8de` input border = 1.43:1 (fails 1.4.11). `--muted` (5.04:1) and the accent button (4.70:1) pass.

**2.11 Light + dark.** Use paired 12-step scales (S4) so each token has a defined twin; dark surfaces rise in lightness with elevation (S1). Status colours in dark use the light-text step (step 11 dark), not the solid.

**2.12 EN/FR expansion.** Short strings grow most: buttons/tabs 2–3× worst case, sentences ~1.3× (S18). "Send" → "Envoyer", "Save as test case" → "Enregistrer comme cas de test" (+60 %). Therefore: no fixed-width buttons or tabs, tabs scroll horizontally rather than wrap, labels above fields, no text in images, no CSS `content:` strings (V1's `details.box summary::after { content:"Show" }` is untranslatable).

## 3. Mood board (look at these, steal the named detail)

1. **Linear** app — https://linear.app/now/how-we-redesigned-the-linear-ui — calm neutral chrome, accent used sparingly, aligned sidebar icons/labels.
2. **Vercel dashboard / Geist** — https://vercel.com/geist/colors — strict step semantics; mono labels for IDs, durations.
3. **Stripe dashboard** — https://stripe.com/blog/accessible-color-systems — status badges (Succeeded/Failed/Refunded) that pass contrast on tinted fills; payments vocabulary.
4. **Hoppscotch** — https://hoppscotch.io — the API tester reference: method+URL+Send bar, tabbed config, response meta strip.
5. **Raycast** — https://www.raycast.com/blog/a-fresh-look-and-feel — bottom action bar with shortcuts, ⌘K actions.
6. **Supabase Studio** — https://supabase.com/design-system — SQL editor + results grid; Code Block and Filter Bar fragments.
7. **Plane** — https://plane.so — list/board/spreadsheet switch for tracker tools (UAT, backlog).
8. **Radix Colors** — https://www.radix-ui.com/colors — the palette source.
9. **Carbon data table** — https://carbondesignsystem.com/components/data-table/style/ — density ladder.
10. **GOV.UK error messages** — https://design-system.service.gov.uk/components/error-message/ — error wording and placement.
11. **cmdk** — https://github.com/pacocoursey/cmdk — command palette behaviour.
12. **Lucide** — https://lucide.dev — one consistent 24-grid, 2 px stroke icon set.

Direction in one line: **"Linear calm + Hoppscotch anatomy + Stripe status badges."** Neutral slate canvas, one indigo accent, colour reserved for state.

## 4. Tokens (drop-in CSS custom properties)

Palette = Radix slate + indigo, with status text darkened where Radix step 11 missed 4.5:1 on its own tint (green 4.21, blue 4.25). Verified ratios in comments.

```css
:root {
  /* neutrals — Radix slate light */
  --bg: #fcfcfd;  --bg-subtle: #f9f9fb;  --surface: #ffffff;
  --hover: #f0f0f3; --active: #e8e8ec; --selected: #e0e1e6;
  --line: #e8e8ec;          /* separators (decorative, no contrast req.) */
  --line-strong: #d9d9e0;   /* panel/card borders */
  --border-field: #8b8d98;  /* inputs/selects: 3.30:1 on #fff  (1.4.11) */
  --fg: #1c2024;    /* 15.98:1 */
  --fg-2: #60646c;  /* secondary text 5.94:1 on #fff, 5.22 on --hover */
  --fg-3: #80838d;  /* placeholders, icons, line numbers only: 3.78:1 — NOT body text */
  /* accent — Radix indigo */
  --accent: #3e63dd; --accent-hover: #3358d4; --accent-fg: #ffffff; /* 5.21:1 / 6.02:1 */
  --accent-text: #3a5bc7;   /* links 6.00:1 */
  --accent-soft: #edf2fe;   /* selected tab/row tint; accent-text on it 5.35:1 */
  --focus: #3e63dd;
  /* status: text on soft fill ≥4.5:1, solid for dots/bars */
  --ok: #1d7a50;   --ok-soft: #e6f6eb;   --ok-solid: #30a46c;   /* 2xx, Pass  4.74:1 */
  --info: #0a65b3; --info-soft: #e6f4fe; --info-solid: #0090ff; /* 3xx, Info  5.31:1 */
  --warn: #9a5a00; --warn-soft: #fff7c2; --warn-solid: #ffc53d; /* 4xx, Blocked/Pending 5.04:1 */
  --bad: #ce2c31;  --bad-soft: #feebec;  --bad-solid: #e5484d;  /* 5xx, Fail, network error 4.54:1 */
  /* code */
  --code-key: var(--accent-text); --code-str: var(--ok); --code-num: var(--warn);
  --code-bool: var(--bad); --code-punct: var(--fg-3);

  /* type — Inter (OFL) + JetBrains Mono (OFL), already loaded */
  --sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --fs-11: 11px;   /* overline/kbd, weight 500, lh 16px */
  --fs-12: 12px;   /* meta, table header, badges, lh 16px */
  --fs-13: 13px;   /* UI default: labels, inputs, tables, lh 20px */
  --fs-14: 14px;   /* prose/doc body, lh 22px */
  --fs-16: 16px;   /* panel title, weight 600, lh 24px */
  --fs-20: 20px;   /* section title, weight 600, lh 28px, -0.01em */
  --fs-24: 24px;   /* page title, weight 600, lh 32px, -0.02em */
  --fs-code: 12.5px; /* lh 20px */
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600;

  /* spacing — 4px base */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px;
  --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px;
  /* control heights */
  --h-sm: 28px; --h-md: 32px; --h-lg: 40px;   /* all ≥24px target (2.5.8) */
  --row-compact: 32px; --row-default: 40px;

  /* radii */
  --r-xs: 4px;  /* kbd, code chips */
  --r-sm: 6px;  /* buttons, inputs, tabs */
  --r-md: 8px;  /* cards, panes, menus */
  --r-lg: 12px; /* dialogs, palette */
  --r-full: 999px; /* badges */

  /* shadows (light) */
  --sh-1: 0 1px 2px rgb(16 24 40 / .06);                                   /* raised button, sticky header */
  --sh-2: 0 4px 12px rgb(16 24 40 / .08), 0 1px 3px rgb(16 24 40 / .06);   /* menus, popovers, toast */
  --sh-3: 0 16px 48px rgb(16 24 40 / .16), 0 2px 6px rgb(16 24 40 / .08); /* dialog, command palette */

  /* motion — Carbon productive */
  --ease: cubic-bezier(0.2, 0, 0.38, 0.9);
  --ease-in: cubic-bezier(0, 0, 0.38, 0.9);   /* entering */
  --ease-out: cubic-bezier(0.2, 0, 1, 0.9);   /* exiting */
  --t-1: 70ms;   /* hover, press, toggle */
  --t-2: 110ms;  /* fades, tab underline */
  --t-3: 150ms;  /* disclosure, menu open */
  --t-4: 240ms;  /* toast, pane resize snap, palette */
  color-scheme: light;
}
:root[data-theme="dark"] { /* duplicate inside @media (prefers-color-scheme: dark) :root:not([data-theme="light"]) */
  --bg: #111113; --bg-subtle: #18191b; --surface: #18191b;
  --hover: #212225; --active: #272a2d; --selected: #2e3135;
  --line: #272a2d; --line-strong: #363a3f; --border-field: #696e77; /* 3.43:1 on #18191b */
  --fg: #edeef0; --fg-2: #b0b4ba; --fg-3: #8b8d98;   /* 16.25 / 8.45 / 5.33 */
  --accent: #3e63dd; --accent-hover: #5472e4; --accent-fg: #fff;
  --accent-text: #9eb1ff; --accent-soft: #182449;       /* 9.15 / 7.34 */
  --focus: #9eb1ff;
  --ok: #3dd68c;   --ok-soft: #132d21;   --ok-solid: #30a46c;  /* 7.86 */
  --info: #70b8ff; --info-soft: #0d2847; --info-solid: #0090ff; /* 7.08 */
  --warn: #ffca16; --warn-soft: #302008; --warn-solid: #ffc53d; /* 10.26 */
  --bad: #ff9592;  --bad-soft: #3b1219;  --bad-solid: #e5484d;  /* 7.75 */
  --sh-1: 0 1px 2px rgb(0 0 0 / .4);
  --sh-2: 0 4px 12px rgb(0 0 0 / .5), 0 0 0 1px #272a2d;
  --sh-3: 0 16px 48px rgb(0 0 0 / .6), 0 0 0 1px #363a3f;
  color-scheme: dark;
}
@media (prefers-reduced-motion: reduce) { :root { --t-1: 0ms; --t-2: 0ms; --t-3: 0ms; --t-4: 0ms; } }
body { font: var(--fw-regular) var(--fs-13)/20px var(--sans); font-feature-settings: "cv11", "ss02"; }
.num, td.num, .meta { font-variant-numeric: tabular-nums slashed-zero; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

Status mapping: HTTP 1xx/3xx → info; 2xx → ok; 4xx → warn; 5xx + network/CORS/timeout → bad. Test results: Pass ok, Fail bad, Blocked warn, Not run neutral (`--fg-2` on `--hover`). Badge = soft fill + text colour + icon (Lucide `check`, `x`, `alert-triangle`, `arrow-right`) + label, 20 px high, `--fs-12` weight 500.

Icons: **Lucide** (ISC), UMD pinned (e.g. `https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`, any version ≥ 2 weeks old) or inline the ~40 SVGs we use. 16 px in UI, 14 px inside badges, 20 px in empty states; `stroke-width: 1.75` at 16 px; colour `--fg-2`, `--fg` on hover.

## 5. Screen template (what every tool shares)

```
┌ page head: crumb · Title (24/600) · one-line purpose (14, --fg-2) · [Load sample ▾ Visa EN | CB FR] ┐
├ command bar: required inputs (3–4) ………………………………………… [Primary ⌘↵] ┤
├─ config pane ─────────────┬─ results pane ──────────────────────┤
│ Tabs: A · B 3 · C         │ meta strip: ● 200 OK · 182 ms · 1.2 KB│
│ fields…                   │ [Pretty|Raw|Headers]        [Copy]  │
│ ▸ Advanced · 2 set        │ body / table / chart                │
├───────────────────────────┴─────────────────────────────────────┤
│ action bar: Save as… · Export ▾ · Ask Claude         ⌘K  ?      │
└─────────────────────────────────────────────────────────────────┘
```
Tool screens drop V1's 880 px column: fluid, max 1 440 px, 24 px gutters; documents (PRD reader) keep a 72 ch measure.

## 9. Review checklist (apply to every screen, both themes, both languages)

**Hierarchy**
- [ ] One primary button per screen, visible without scroll, with its shortcut (⌘/Ctrl+↵).
- [ ] Required inputs ≤ 4 and first; the rest under "Advanced · n set".
- [ ] Results area has a meta strip (status/time/size or rows/duration) before the body.
- [ ] Page has title + one-line purpose + "Load sample"; sample runs in < 60 s.

**Forms**
- [ ] Every field has a visible label above (no placeholder-as-label) and `for`/`id` wired.
- [ ] Hints say format with an example; errors say how to fix ("Enter…"), appear on blur/submit, under the field, red border + icon, and in a top summary on submit.
- [ ] Entered values are preserved after an error.

**Tables & code**
- [ ] Numbers right-aligned, `tabular-nums`; header aligned with column.
- [ ] Row height 32 or 40 px; sticky header; hover state; ≤ 2 inline row actions.
- [ ] JSON viewer: pretty/raw, fold, copy, line numbers, palette syntax colours.

**States**
- [ ] Empty, loading (≥ 1 s spinner + elapsed; batch = "n of N"), error, and success designed — screenshot each.
- [ ] Errors live in the pane; toasts only confirm side effects, `aria-live="polite"`, one at a time.

**Accessibility**
- [ ] No text below 4.5:1 (`--fg-3` only for placeholders/icons); field borders ≥ 3:1.
- [ ] Status never colour-only (icon + text).
- [ ] Tab order follows reading order; focus ring visible on every control; Esc closes overlays and returns focus.
- [ ] Targets ≥ 24×24 px; tabs/segmented use proper roles (`tablist`/`tab`, `radiogroup`).
- [ ] `prefers-reduced-motion` honoured.

**Tokens & craft**
- [ ] Zero hard-coded hex/px outside tokens (`grep '#[0-9a-f]\{3,6\}'` in component CSS = 0).
- [ ] Only Lucide icons, one size per context; only Inter/JetBrains Mono; only weights 400/500/600.
- [ ] Spacing values from the 4 px scale; radii from the 4 token values.
- [ ] Light and dark screenshots both checked; no element disappears in dark.

**Bilingual**
- [ ] FR screenshot checked: no truncated buttons/tabs, no overflow at 1 280 px and 390 px.
- [ ] No strings in CSS `content:` or images; all copy through `i18n.js`.
- [ ] Numbers/dates/amounts via `Intl` (FR: `1 234,56 €`, EN: `€1,234.56`).

## Decisions for Analyst Kit V2

1. **Palette:** Radix slate neutrals + single indigo accent `#3e63dd` (dark text variant `#9eb1ff`); replaces V1 `#5e6ad2`. Colour is reserved for state.
2. **Fix V1 contrast failures:** retire `--faint` as a text colour (2.62:1); `--fg-3 #80838d` for non-text only; field borders `#8b8d98` (3.30:1); error text `#ce2c31` (5.21:1).
3. **Status system:** 2xx/Pass = ok, 3xx = info, 4xx/Blocked = warn, 5xx/Fail/network = bad, always soft fill + icon + text, using the tokens in §4.
4. **Type:** keep Inter + JetBrains Mono (already loaded, OFL); UI base 13/20, prose 14/22, page title 24/32/600; weights 400/500/600 only; `tabular-nums` on all numbers.
5. **Spacing/radii/shadows/motion** exactly as §4 tokens (4 px scale; radii 4/6/8/12; 3 shadows; Carbon productive easing, 70–240 ms, zero under reduced-motion).
6. **Icons:** Lucide only, pinned version or inlined SVG sprite; replace V1 hand-drawn SVGs.
7. **One tool-screen template** (§5) for all 18 tools: page head + sample picker, command bar with ≤ 4 required inputs and primary action, config pane | results pane, bottom action bar.
8. **Split pane** horizontal ≥ 1 200 px, stacked below; resizable, keyboard-operable, ratio remembered per tool.
9. **Tabs** for panels (with counts), **segmented** for immediate view switches, **select** above 5 options; no toggles for submit-time options.
10. **Tables:** 32 px compact for data grids, 40 px default; hairlines + hover, zebra only ≥ 8 columns; sticky header.
11. **Shared JSON/code viewer** component (fold, copy, pretty/raw, line numbers) used by API tester, SQL runner, exports.
12. **Feedback:** NN/g timing (none < 1 s, spinner + elapsed 1–10 s, "n of N" for batches); toasts bottom-right 4 s/8 s with Undo, `aria-live`.
13. **Command palette ⌘/Ctrl+K** (tools, samples, actions, theme, language) with EN+FR keywords; ⌘/Ctrl+↵ runs the primary action everywhere; `?` shortcut sheet.
14. **Bilingual layout:** no fixed widths on buttons/tabs, tabs scroll not wrap, design and screenshot every screen in FR (the longer language) first; move all CSS `content:` strings into i18n.
15. **Every screen passes the §9 checklist** in light + dark and EN + FR before it is called done; screenshots of the empty, loading, error and success states go with the changelog.

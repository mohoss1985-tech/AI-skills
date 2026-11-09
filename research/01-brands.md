# 01 · What makes pro tools feel crafted (brand research)

Scope: dense B2B workbench (sidebar + forms + tables + code/response panes). Values were pulled from the live CSS of linear.app, docs.stripe.com (Sail) and @primer/primitives@9.1.1 (on 2026-11-08), plus the official guideline pages. Anything not verified is labelled.

## Sources
- Linear redesign write-up: https://linear.app/now/how-we-redesigned-the-linear-ui
- Linear live CSS tokens: https://linear.app (stylesheets under static.linear.app/web/_next/static/css/*)
- Stripe docs/API reference and the Sail CSS: https://docs.stripe.com/api/charges/create (b.stripecdn.com/docs-statics-srv/assets/sail.*.css)
- Stripe Apps style tokens (spacing): https://docs.stripe.com/stripe-apps/style
- GitHub Primer size primitives: https://primer.style/foundations/primitives/size
- Primer typography tokens: https://primer.style/product/primitives/typography/
- Primer colour tokens: https://unpkg.com/@primer/primitives@9.1.1/dist/css/functional/themes/light.css (and dark.css)
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Vercel Geist colours and typography: https://vercel.com/geist/colors, https://vercel.com/geist/typography
- Radix Colors scale semantics: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Raycast action panel (keyboard model): https://developers.raycast.com/api-reference/user-interface/action-panel
- Vibe-coded tells: https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui, https://jc-aiwiki.pages.dev/ai-web-design/unslop-ui
- Apple HIG typography: https://developer.apple.com/design/human-interface-guidelines/typography (the page rendered client-side and could not be read. The macOS values below are from memory: **unverified**.)

## Findings

### 1. Type: small, tight, few weights
- **Linear** (live CSS): text-mini 13px/1.5, text-small 14px/1.5, text-regular 15px/1.6, text-micro 12px/1.4, text-tiny 10px. Titles are 20/24/36px. The weights are *variable-font in-betweens*: 400 normal, **510 medium, 590 semibold**, 680 bold. Headings use Inter Display and body text uses Inter.
- **Stripe Sail**: discrete sizes 11, 12, 13, 14, 15, 16, 20, 24, 28, 32px and only three weights (400 / 500 / 700). Uppercase labels sit at line-height 15px.
- **Primer**: body 14px/1.5, small 12px/1.625, caption 12px/1.25, title-small 16px/600, title-medium 20px/600, title-large 32px/600, **code 13px/1.5**. Line heights align to a 4px grid, and sizes are in rem so browser zoom works.
- **Vercel Geist** splits styles into *label* (single line), *copy* (multi-line, taller leading) and *mono* variants at 12/13/14. Monospace is a first-class style, not an afterthought.
- **macOS HIG** (unverified): body 13pt, headline 13pt bold, callout 12, subheadline 11, caption 10. The desktop-app base is 13px, not 16px.
- **Common ground:** the body is 13–14px, there are 2–3 weights, headings are at most 24px inside the app, and every token is a discrete step (no 13.5px or 12.5px fractions).

### 2. Spacing and sizing grid
- Primer spacing: 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64…
- Stripe Apps: 2, 4, 8, 16, 24, 32, 48.
- **Control heights** (Primer): 24 xs, **28 small, 32 medium (default), 40 large**, 48 xl.
- Vercel: hit area ≥ 24px on desktop and ≥ 44px on touch.

### 3. Radii: small and concentric
- Primer: 3 / **6 (default)** / 12 / full.
- Stripe Sail: 1–4px, and docs cards use `--card-border-radius: 4px`.
- Linear: 4 / 6 / 8 / 12 / 16. Buttons use radius-4 or full, the editor uses 6, and cards use 12.
- Vercel: a child radius is ≤ its parent radius and concentric (inner = outer − padding).

### 4. Colour: neutral-first, one accent, steps with jobs
- **Linear light**: bg #ffffff / level-1 #f8f8f8 / level-2 #f4f4f4 / level-3 #f0f0f0. Text #282a30 / #3c4149 / #6f6e77 / #86848d. Borders #e9e8ea / #e4e2e4 / #dcdbdd. Brand #5e6ad2.
- **Linear dark**: bg #08090a / #0f1011 / #141516 / #191a1b. Text #f7f8f8 / #d0d6e0 / #8a8f98 / #62666d. Borders #23252a / #34343a / #3e3e44. Accent #7170ff, hover #828fff.
- **Linear translucent borders**: `#0000000d` (5% black) and `#ffffff0d`. Hairlines are alpha, so they sit correctly on every surface level.
- In its redesign, Linear cut **98 theme variables down to 3 inputs** (base, accent, contrast), generated in LCH. It also "limited how much accent blue feeds into the colour calculations" to make the palette more neutral, and raised text contrast.
- **Primer light**: fg #1f2328 / muted #59636e, bg #ffffff / muted #f6f8fa, border #d1d9e0, accent and focus #0969da, success #1a7f37 on #dafbe1, attention #9a6700 on #fff8c5, danger #d1242f on #ffebe9.
- **Primer dark**: fg #f0f6fc / muted #9198a1, bg #0d1117 / muted #151b23 / inset #010409, border #3d444d, focus #1f6feb.
- **Stripe**: gray-100 rgb(235,238,241), blurple rgb(98,90,250) / docs blue rgb(84,105,212). Text defaults to gray-700, not black.
- **Radix 12-step semantics**: 1–2 app and subtle background, 3/4/5 component rest / hover / pressed, 6/7/8 border subtle / interactive / strong + focus, 9/10 solid / solid hover, 11/12 low- and high-contrast text. Geist uses the same idea in 10 steps (100–300 bg, 400–600 border, 700–800 solid, 900–1000 text).

### 5. Borders, elevation, focus
- In-page structure comes from **1px hairlines** (Primer's borderWidth-thin is the default). Shadows are kept for floating layers only.
- Stripe shadows are always two layers (ambient + key), e.g. `0 2px 5px 0 ambient, 0 1px 1px 0 key`. Vercel requires at least two layers too.
- Linear shadow-low is `0 1px 4px -1px #00000017`, and shadow-medium is `0 3px 12px #00000017`.
- **Focus rings**:
  - Linear: 2px solid, offset 2px, accent colour.
  - Primer: 2px, offset −2px (inset), #0969da.
  - Stripe: a 4px soft halo plus a 1px keyline.
  - All of them use `:focus-visible` only (Vercel). Hover, active and focus states must have more contrast than the rest state.

### 6. Motion
- Linear: quickTransition **100ms**, regularTransition 250ms, highlightFadeOut 150ms, and an ease-out-quart curve `cubic-bezier(.165,.84,.44,1)`.
- Stripe Sail: 80 (fast-out), **120 (fast)**, 160 (out), 240 (default), 320, 400ms.
- Vercel:
  - Animate only transform and opacity. "Never `transition: all`".
  - Honour `prefers-reduced-motion`.
  - Wait 150–300ms before showing a spinner, then keep it up for at least 300–500ms.
- Primer waits 1s before announcing a loading state.

### 7. Content and interaction rules (Vercel, Stripe, Raycast)
- Use tabular numerals for anything compared. Use real ellipsis (…) on labels that open something, and `&nbsp;` between a value and its unit.
- Keep submit enabled until the request starts, then disable it and show a spinner. On error, focus the first invalid field and show the message inline. Never block keystrokes or paste.
- In a textarea, **⌘/Ctrl+Enter submits**. Raycast forms bind the primary action to ⌘↵ and the secondary to ⌘⇧↵. In lists, ↵ is primary and ⌘↵ is secondary.
- Stripe's API reference uses a three-column layout: nav, then prose with a parameter list (name in mono, type, "Required" tag, description; nested parameters collapsed), then a sticky dark code pane with a language picker, a copy button, and the request above the response.
- Linear's chrome is an "inverted L" of sidebar and top bar framing one main view. The redesign aligned sidebar icons and labels on both axes and increased hierarchy while reducing noise.

### 8. Vibe-coded tells (what to avoid)
From the Fountain Institute and unslop-ui, cross-checked against what the brands above *don't* do:
1. Purple-to-indigo gradients, gradient text, and gradient buttons.
2. Neon or glow effects on dark backgrounds, glassmorphism, and bouncy easing.
3. **Emoji as icons, bullets, or nav.**
4. Cards inside cards ("card soup"), and three equal cards each with an icon in a tinted circle.
5. Coloured left-border stripes on every block, used as decoration.
6. Status dots with no defined meaning.
7. A floating pill badge above a centred hero headline.
8. The default shadcn/Tailwind look (`rounded-xl` plus `shadow-lg` on everything).

Further tells observed by contrast with the references:
- Off-grid sizes (13.5px, 12.5px, 9px gaps).
- More than three font weights.
- Mixed radii (5, 6, 7, 10px on one screen).
- Shadows used for in-page structure.
- `filter: brightness()` used as a hover state.
- A different hover treatment on every component.
- Generic copy ("Unleash", "Supercharge", "Seamless").
- Title Case and sentence case mixed together.

**Current Analyst Kit V1 CSS already shows several of these:**
- Off-grid sizes: 13.5px body, 12.5px and 11.5px text, 14.5px lede.
- Mixed radii: 3, 4, 5, 6, 7 and 10px.
- `filter: brightness(1.08)` on the primary button.
- Accent #5e6ad2 is exactly Linear's brand indigo, so the app reads as a Linear clone.
- 9px gaps.

## Decisions for Analyst Kit V2

1. **Type scale (px, fixed tokens, no fractions):** `--fs-11: 11px` (overline/kbd), `--fs-12` (meta, table secondary), `--fs-13` (UI base: body, inputs, table cells, buttons), `--fs-14` (prose / descriptions), `--fs-16` (section titles), `--fs-20` (page title), `--fs-24` (landing only). Line heights: 16/18/20/22/24/28/32px (4px grid). Body is `13px/20px`. Use only 13px or more for anything a user reads; 11px is for labels only.
2. **Weights: 400, 500, 600 only.** If Inter Variable is bundled, use 400 / 510 / 590 (Linear's values). Never 700 in the app.
3. **Fonts:** UI uses `Inter, system-ui`, with `font-feature-settings: "cv11","ss01"`. Code uses `"JetBrains Mono", ui-monospace` at **12–13px/20px**. Apply `font-variant-numeric: tabular-nums` to `table, .num, .mono, kbd, time`, and to status codes, durations and byte sizes.
4. **Spacing tokens:** `--s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px`, plus 2px and 6px for icon nudges. Ban every other gap value. Page padding is 24px for tool screens (dense) and 40px for document screens.
5. **Control heights:** 24 (in-table, segmented), **28 (default in tool panes)**, 32 (forms and primary actions), 40 (single hero CTA only). Inputs, selects and buttons in one row share one height.
6. **Radii: exactly three plus full.** `--r-sm: 4px` (inputs, buttons, chips, kbd), `--r-md: 6px` (menus, popovers, code blocks, table containers), `--r-lg: 10px` (dialogs and the outer panel only), and `999px` (status pills). A nested element's radius equals its parent's minus the padding, and is never larger.
7. **Colour model: 12 neutral steps plus 1 accent plus 4 status colours, Radix semantics.** Light neutrals: `#ffffff, #fafafa, #f4f4f5, #eeeef0 (hover), #e7e7ea (pressed/selected), #e4e4e7 (border-subtle), #d4d4d8 (border), #a1a1aa (border-strong), —, —, #63636b (text-2), #18181b (text)`. Dark neutrals: `#0a0a0b, #111113, #18181b, #1f1f23, #26262b, #27272a, #34343a, #52525b, …, #a1a1aa, #f4f4f5`. Write hairlines as alpha (`rgb(0 0 0 / .08)` light, `rgb(255 255 255 / .08)` dark) so they work on every surface.
8. **Accent: not Linear indigo, not purple.** Use a payments-appropriate blue, `--accent: #2563eb` light / `#4f8cff` dark (close to Primer's #0969da / #1f6feb, so it is proven to pass contrast). Use it only for the primary button, the focus ring, links, the selected nav item's icon, and the active tab underline. Nothing decorative.
9. **Status colours** (text on tinted background, Primer pairs): ok `#1a7f37` / `#dafbe1`, warn `#9a6700` / `#fff8c5`, error `#d1242f` / `#ffebe9`, info is the accent. Status colour sits only on the text or the dot, never on a full card. Every dot gets a text label.
10. **HTTP method colours** (the API tester): GET #1a7f37, POST #9a6700, PUT/PATCH #2563eb, DELETE #d1242f, set as 11px/600 uppercase mono text with no filled pill. Response status uses the same mapping by class (2xx ok, 3xx info, 4xx warn, 5xx error).
11. **Borders, not shadows, define structure.** Sidebar, panes, tables and inputs use 1px hairlines. Shadows only for popovers, menus, toasts and dialogs, always two layers: `0 1px 2px rgb(0 0 0/.06), 0 4px 12px rgb(0 0 0/.08)` (dialog: `0 2px 4px …/.06, 0 12px 32px …/.14`). In dark mode, drop the shadow and raise the surface one step plus a hairline.
12. **Focus ring:** `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. On inputs, use `outline-offset: -1px` and a border-colour change instead of a halo. Never `outline: none` without a replacement, and never `:focus` alone.
13. **Interaction states:** rest → hover = one neutral step up, hover → pressed = one more step. The same rule applies to every list row, nav item, ghost button and tab. Primary hover uses a darker token (`--accent-hover`), never `filter`.
14. **Motion tokens:** `--t-fast: 100ms` (hover, colour), `--t-base: 160ms` (popover, tab indicator), `--t-slow: 240ms` (dialog, drawer), with ease `cubic-bezier(.165,.84,.44,1)`. List the properties explicitly. Under `prefers-reduced-motion: reduce`, use 0ms.
15. **Loading:** show a spinner or skeleton only after 200ms, and keep it at least 400ms. "Send" keeps its width (no layout shift) and is disabled with an inline spinner while the request is in flight. Show elapsed ms live in the response header.
16. **Layout = Linear "inverted L" + Stripe 3-pane.**
    - Sidebar is 232px with 28px nav rows, 16px icons, and 8px icon-label gap, with icons and labels aligned on one vertical axis.
    - A 44px top bar holds the breadcrumb, then the tool name, then actions on the right.
    - Tool screens split into request/inputs on the left and response/result on the right (min 360px each, resizable with a 1px divider and a 6px hit zone). The response pane gets a `--bg-2` code surface.
    - Document screens keep a 720px reading column.
17. **No card soup.** A screen gets at most one bordered container level. Group with 24px whitespace and 13px/600 sentence-case section labels in `--text-2`. Use cards only for independently actionable items (the tool launcher grid).
18. **Tables:** 32px rows (28px compact), 12px horizontal cell padding, 1px row separators, no zebra striping. The header is 12px/500 `--text-2` and sticky. Numbers are right-aligned and tabular. Truncate with ellipsis and show the full value in a `title` attribute.
19. **Parameter lists** (Stripe pattern) for every tool's inputs: the name in mono 13px/500, then the type in 12px `--text-2`, then a "required" tag in 11px warn text. The description sits below at 13px. Advanced fields are collapsed under a "More options" disclosure, which supports GOAL principle 2 (minimum inputs).
20. **Code / response pane:**
    - Mono 12px/20px with line numbers in `--text-3`.
    - Above the code, a tab strip (Body · Headers · Assertions · curl) with a 2px accent underline.
    - A copy button with a "Copied" state for 1.5s.
    - JSON key colour is `--text`, strings are ok-green and numbers the accent. Limit it to **3 syntax colours**.
21. **Keyboard model** (show it in the UI as `<kbd>` 11px mono with a 1px border, 4px radius and 18px height):
    - ⌘/Ctrl+Enter sends or runs on every tool (Raycast/Vercel). ⌘K opens the command palette and tool switcher. `/` focuses search. Esc closes the overlay or cancels the in-flight request.
    - ⌘S saves as a test case. ⌘⇧C copies as curl. `g` then `t` goes to tools, Linear-style.
    - Enter in a textarea inserts a newline.
22. **Copy rules:** sentence case everywhere ("Send request", "Save as test case"), with no Title Case mixing. Verbs on buttons. Use the ellipsis glyph "…" on labels that open a dialog. Use `&nbsp;` in "200&nbsp;ms" and "1.2&nbsp;KB". No marketing words (unleash, supercharge, seamless, magic, AI-powered). Write EN/FR strings at the same register.
23. **Banned list** (lint it in review): gradients of any kind (except a 1px divider fade), emoji in UI chrome, glow or neon, glassmorphism or `backdrop-filter` blur outside the top bar, `transition: all`, `filter: brightness` hovers, coloured left-border stripes used as decoration, icon-in-tinted-circle feature trios, radii outside {4, 6, 10, 999}, font sizes outside the scale, weight 700+, and more than one accent hue.
24. **Icons:** one set (Lucide-style 1.5px stroke) at 16px in the UI and 14px inline in tables, coloured `--text-3` at rest and `--text` on hover or selected. No filled or two-tone mixing.
25. **Theme plumbing:** set `color-scheme` on `:root` per theme and `<meta name="theme-color">` to the background. Dark mode is designed (raised surfaces = lighter), not inverted. Text in dark mode is `#f4f4f5`, never `#ffffff`, on `#0a0a0b`.

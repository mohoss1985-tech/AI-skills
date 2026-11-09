# Wave 1 · A · design system, shell, core

Done 2026-11-09. Contract for tool builders: `research/wave1-A-api.md` (published first, stable, additive since).
Nothing committed. Checked on `PORT=4301` (local) and on the static export (`export_static.py` → served on :4302).

## What I built

**Design system** (`app/web/css/`)
- `tokens.css`: DESIGN_SPEC §1–§2 tokens. Radix slate neutrals, blue accent (`#2563eb`; text step `#1d4ed8` light / `#7aa7ff` dark),
  status pairs ok/info/warn/bad (soft + text + solid), method colours, type scale 11/12/13/14/16/20/24 with 4-pt line heights,
  weights 400/500/600, spacing 4–48, control heights 24/28/32/40, radii 4/6/10/full, shadows for floating layers only,
  motion 100/160/240 ms (0 under reduced motion). Light + dark (system default, `data-theme` override). V1 token names kept
  as aliases (`--muted`, `--faint` → `--fg-2`, which fixes V1's 2.62:1 failure). Contrast computed: every text pair ≥ 4.5:1,
  field borders 3.30 / 3.43:1 (numbers in the file header).
- Fonts vendored: Inter 400/500/600 + JetBrains Mono 400/500 (latin + latin-ext woff2, OFL) in `app/web/fonts/`.
- `base.css` (reset, focus ring, utilities), `layout.css` (232 px sidebar, 44 px top bar, pages, mobile drawer < 860 px),
  `components.css` (all ui/*, tool frame, palette, Home, every ported V1 view, markdown, BPMN, Guide), `print.css` (client copy).
- Banned-list lint: no gradients, no `transition: all`, no filter hovers, no hex in component CSS (one data-URI chevron in
  `select.input`), no weight 700 (`b, strong` forced to 600), all sizes/radii on scale.

**Vendored libraries** (`app/web/vendor/`, no CDN left, lazy-loaded by `core/lazy.js`): marked 15.0.12, DOMPurify 3.2.6,
mermaid 11.17.2, bpmn-js 18.31.1 (navigated viewer + modeler + css), sql.js 1.14.2 (wasm), highlight.js 11.11.1 (+ gherkin).
Lucide 0.460.0 sprite (126 icons, `icons/lucide.svg`) + favicon. Licences copied next to each. Only marked + DOMPurify load at boot
(the Guide renders markdown synchronously); mermaid / bpmn-js load when a document contains a diagram (V1 loaded ~3 MB on every page).

**Core** (`js/core/`)
- `api.js`: B's contract — `GET /api/config` token, `X-Kit-Token` on writes, refetch + retry once on `security.bad_token`,
  `{error: {code, message}}` → `ApiError(.code, .status)` translated via `t('err.<code>')`, ETag/304 cache for `/api/state` and
  `/api/catalog`, `put`, `net` (online state → "server offline" banner instead of a frozen UI).
- `store.js`: `ServerStore` on B's routes (POST create, PUT update), `LocalStore` on IndexedDB → localStorage → memory, all try/catch
  (verified in the static demo: `LocalStore` round-trip OK).
- `router.js`: `#/deliverables` added; focus moves to the page `h1` on route change; stale-route guard.
- `markdown.js`: lazy libraries, `mdHtml()` (sync, escaped fallback), `ensureMarkdown()`. `lazy.js`: all loaders.

**UI components** (`js/ui/`): button (busy state, kbd), field (label/hint/error, aria wiring), input, textarea, select, segmented,
tabs (counts, arrow keys, panels), table (sticky header, numeric columns), grid (editable, keyboard navigation, computed columns,
Fibonacci cells, add/remove rows), modal (native dialog, focus return), toast (aria-live, one at a time, action, pause on hover),
emptyState, codeEditor (textarea + highlight.js overlay, line numbers), kvEditor, jsonView (fold, counts, Pretty/Raw, copy,
click-a-value `onPick`), splitpane (drag + keyboard, ratio remembered, stacks < 1200 px), statusPill, methodChip, plus badge,
menu, advanced ("Advanced · n set"), spinner (after 200 ms, elapsed time), copyButton, icon.

**Shell** (`js/shell/`)
- `tool-frame.js`: the §4 template — head (group eyebrow + skill page link, title, purpose, **Visa EN | CB FR** + Load sample ▾ /
  Start empty), command bar with the primary button (⌘↵), error summary, config | results with status strip, sticky action bar
  (Save as deliverable ⌘S → `/publish` · Export ▾ incl. Markdown · Ask Claude ▾ → `/ai`, "Copy prompt for Claude" dialog in demo).
  Autosave (1 s), restore (`?sample`, `?ws`, in-tab memo, last workspace), run records, `migrate()`.
- `sidebar.js` (Home · Deliverables · Chat · Guide · 20 tools in 6 groups · profile), `topbar.js` (crumb, ⌘K search, Claude dot,
  theme, EN/FR, mobile menu), `palette.js` (⌘K: tools, samples, pages, actions, deliverables; EN+FR keywords, "rejeu" finds the
  chargeback tool), `example-tool.js` (runnable reference tool).

**Views**: Home rebuilt (3 demo cards → `?sample=`, all 20 tools by group, ask Claude, recent deliverables, disclaimer EN/FR).
New `#/deliverables` (V1 list, search, status filters + "Start a deliverable" + skill page links). Deliverable, chat, profile,
new, skill page restyled with every V1 feature kept (Word/PDF/Copy, mark as sent, versions, sources, continue, conversation,
quick replies, knowledge files, Xray assistant, scenarios) + "Open in tool" when the deliverable comes from a workspace.
**Guide** ported to real modules: `window.Kit` bridge and `kit-shim.js` removed, `window.KIT_GUIDE_FR`/`window.KitChat` now exports;
Guide button in the sidebar, Esc returns focus.

**i18n**: ~90 new FR strings in `i18n/fr.js` (every literal `t()/L()` key in my files has FR; script check = 0 missing).

## Accessibility fixes (research/07 §2)
aria-live toast; focus to `h1` on route change; type cards / tool cards are links (keyboard reachable); contrast fixed; skip link;
`aria-current` in nav and crumb; tabs/segmented/menu/palette with proper roles and arrow keys; Guide no longer a fake dialog;
shortcuts shown in UI (`kbd` in buttons, sidebar `?`, palette); status never colour-only (pill text, badge icons).

## Verification
Headless Edge over CDP, 1440×900: Home, Deliverables, deliverable #1 (BPMN), chat, profile, new, skill page, tool stub,
example tool (empty, validation error, sample → run), palette, Guide — light/dark × EN/FR: **zero JS exceptions, zero console
errors** (only expected `400` when the example tool, which is not a registry id, autosaves). Static demo: same pages, zero errors.
Screenshots: `screenshots/v2/A-*.png` (19 files, incl. 390 px mobile).

## Open issues / notes for others
- **B**: `/api/workspaces` rejects unknown tool ids (correct); the frame swallows autosave failures silently (console only).
- Tool stubs still render the V1 form inside the frame with their own "New deliverable" heading; builders replace them.
- The toolbar `select.input` chevron is an inline SVG data URI with a fixed grey (`#80838d`) — the one hex in component CSS.
- BPMN canvases stay white in dark mode on purpose (matches exported images); mermaid re-themes on toggle.
- Sidebar has 20 tools + 4 pages: it scrolls at 900 px height; collapsible groups could come later.
- The Guide panel open state persists per tab (V1 behaviour).
- Numbers inside tools should use `Intl` with `locale()` (tool owners).

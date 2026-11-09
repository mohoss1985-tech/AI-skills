# Wave 1 · A · front-end API for tool builders (C–K)

Status: **stable** (names and signatures below will not change; A only adds). Source of truth = the files; this is the map.
Import paths are from `app/web/js/tools/<id>/index.js`. Everything in `ui/*` is also on `ctx.ui`.

## 1 · Tool module (DESIGN_SPEC §8 + optional fields the frame reads)

```js
export default {
  id, skill, icon /* Lucide name */, title: {en, fr}, schema: 1,
  purpose: {en, fr},                 // one line under the title (page head)
  layout: 'split' | 'single',        // default 'split' if run() exists: mount(el) gets the CONFIG pane;
                                     // 'single': mount(el) gets the whole empty body (no results pane)
  primary: {label: {en, fr}, icon},  // primary button (default "Run", icon play), always shows ⌘↵
  defaults() → state,                // 3–4 primary inputs first
  samples: {en: [S], fr: [S]},       // S = {id, label: str|{en,fr}, hint?, state: {...}, autorun?: true}
                                     // en = Visa / Harbor Bank, fr = CB / Banque Lumière
  mount(el, ctx),                    // build inputs into ctx.frame.command + el (config pane); results into ctx.frame.output
  load?(state, ctx),                 // repaint inputs after sample/reset/restore. If absent the frame remounts (mount again)
  update?(state, ctx),               // after every ctx.setState (unless {silent:true})
  validate?(state) → [{message, field}],  // before run; errors go to the top summary + the bound field
  run?(state, ctx) → result,         // the work; may throw Error (message shown in the results pane; e.hint = 2nd line)
  renderResult?(result, ctx),        // paint ctx.frame.output after a successful run
  status?(result, ms) → pillOpts,    // status strip, e.g. {status: 200, text: 'OK', ms, bytes} / {tone:'ok', rows: 12, ms}
  toMarkdown(state, lastRun) → md,   // "Save as deliverable" + Export ▾ "Markdown (.md)" (always added)
  exports?: [{id, label: {en,fr}, build(state, lastRun) → {name, mime, text}}],   // listed in Export ▾
  aiActions?: [{id, label: {en,fr}, prompt(state, run) → string, expects: 'markdown'|'json'}],  // Ask Claude ▾
  onSave?(ctx),                      // ⌘S override (default ⌘S = Save as deliverable)
  migrate?(oldState, oldSchema) → state,
  tick?(ctx),                        // 3 s refresh (local app only)
}
```

## 2 · ctx (built by `shell/tool-frame.js`)

| Member | |
|---|---|
| `ctx.state` | current state (getter). Starts from `defaults()`, or the last saved workspace of the tool, or `?ws=<id>` ("Open in tool"), or `?sample=en:0` |
| `ctx.setState(patch \| fn, {silent, replace})` | merge (or replace) then `update()`; **autosaves** the workspace 1 s later (ServerStore locally, IndexedDB in the demo) |
| `ctx.run()` | calls `tool.run`, stores `ctx.lastRun`, records a run. Normally you don't call it: the primary button / ⌘↵ does `validate → busy → run → renderResult → status` |
| `ctx.lastRun`, `ctx.workspace` | last result; `{id, …}` once saved |
| `ctx.ai(actionId, run?)` | local: `POST /api/workspaces/:id/ai` (fallback `/api/chat`); demo: opens a "Copy prompt for Claude" dialog. Normally called by the Ask Claude ▾ menu |
| `ctx.save()` / `ctx.publish()` | save workspace / "Save as deliverable" (`/publish` with `toMarkdown`; demo downloads the .md) |
| `ctx.loadSample(lang, i)` | load `samples[lang][i]` (use it in your empty state's "Load sample") |
| `ctx.download(name, mime, text)` | file download |
| `ctx.T(key)` | your namespace: `t('<id>.' + key)` (register `i18n.js` with `register('<id>', strings)` as the stubs do) |
| `ctx.lang`, `ctx.i18n` `{t, register, pick, lang}`, `ctx.toast`, `ctx.ui`, `ctx.store`, `ctx.server` (`{get, post, put, del, api}`, `null` in demo) |
| **`ctx.frame`** | the template slots, below |

`ctx.frame`:

| Member | |
|---|---|
| `command` | div in the command bar: put the 3–4 required inputs here (the primary button is appended for you) |
| `config` | the config pane (= `el` in split layout). Tabs, Advanced disclosure… |
| `output` | results body (under the status strip). `aria-live="polite"`, fades in after each run |
| `actions` | extra buttons in the bottom action bar (after Save · Export · Ask Claude) |
| `setStatus(pillOpts \| null)` | status strip pill (`null` = "No run yet") |
| `setStatusExtra(...nodes)` | right side of the status strip (e.g. a `segmented` Pretty/Raw, a copy button) |
| `busy(on, text?)` | primary button spinner (keeps width) + "Working… 1.4 s" after 200 ms; `text` e.g. `'3 of 12'` |
| `bindField(key, fieldEl)` | so `validate()` / `showErrors([{field: key, message}])` can mark it |
| `showErrors(list)` / `showError(message, detail)` | top error summary / run error in the results pane |
| `setPrimary({label, disabled})`, `runNow()`, `remount()`, `refreshMenus()` (after changing `exports`/`aiActions`) |
| `root`, `head`, `body`, `results`, `status`, `primary` | raw elements if you need them (`.tool-frame.tool-<id>` is the CSS scope) |

## 3 · `ui/*` (all return DOM elements; options objects; all strings you pass are set as text, never HTML)

| Function | Signature → returns |
|---|---|
| `button` | `({label, variant: 'primary'\|'secondary'\|'ghost'\|'danger', size: 'sm'\|'md'\|'lg', icon, iconRight, onClick, type, kbd, title, disabled, ariaLabel})` → `<button>` + `.setBusy(bool)`, `.setLabel(text)`. Icon-only: `icon` + `ariaLabel` |
| `kbdLabel` | `('mod+enter')` → `'⌘↵'` / `'Ctrl+↵'`; also `'mod+s'`, `'mod+shift+c'` |
| `field` | `({label, help, input, id, optional, required, error, mono})` → `.field` + `.control`, `.setError(msg)` (label above, hint, error with icon, aria wired). Without `input` creates a text input |
| `input` | `({value, placeholder, type, mono, onInput(v), onChange(v), ariaLabel, size: 'sm'\|'lg', id})` → `<input class="input">` |
| `textarea` | `({value, placeholder, rows, onInput(v), mono, ariaLabel, id})` |
| `select` | `({options: [v \| {value, label}], value, onChange(v), id, ariaLabel, size, mono})` (use above 5 options) |
| `segmented` | `({options: [{value, label}], value, onChange(v), label, size})` → radiogroup + `.value`, `.set(v)` (≤ 5 immediate options) |
| `tabs` | `({tabs: [{id, label, count}], active, onChange(id), panels: {id: Node}})` → with `panels`: bar + panels; `.select(id)`, `.setCount(id, n)`, `.active` |
| `table` | `({columns: [{key, label, num, align, mono, width, format(v, row) → str\|Node}], rows, onRowClick(row, i), empty, compact = true, caption})` → `.table-wrap` (`.table`, `.setRows(rows)`); sticky header, 32 px rows |
| `grid` | `({columns: [{key, label, type: 'text'\|'number'\|'select'\|'fib'\|'check'\|'readonly', options, width, num, mono, placeholder, format, compute(row)}], rows, onChange(rows), addLabel, removable, newRow(rows) → row, compact})` → `.grid-wrap` + `.getRows()`, `.setRows(rows)` (silent), `.addRow()`, `.focusCell(r, c)`. Arrows move cells, Enter goes down (adds a row on the last one when `addLabel`), Esc restores. `compute` columns recompute live (WSJF score). `FIB` = `[1,2,3,5,8,13,20]` |
| `modal` | `({title, body: Node\|string, actions: [{label, variant, onClick(close) → false keeps open}], onClose, size: 'sm'\|'md'\|'lg'})` → open `<dialog>` (Esc, focus return) |
| `toast` | `(msg)` · `(msg, '#/d/12')` · `(msg, {href, action: {label, onClick}, tone: 'ok'\|'bad'\|'info', ms})` — confirmations only, `aria-live` |
| `emptyState` | `({icon, title, text, action: {label, onClick, kbd}, sample: {label, onClick}})` |
| `codeEditor` | `({value, lang: 'json'\|'sql'\|'xml'\|'bash'\|'javascript'\|'python'\|'yaml'\|'gherkin', onChange(v), rows, readonly, placeholder, ariaLabel, lineNumbers = true})` → `.code-editor` + `.value` get/set, `.textarea`, `.setLang(l)`, `.focus()` (highlight.js 11.11.1, lazy) |
| `kvEditor` | `({rows: [{key, value, on}], onChange(rows), keyPlaceholder, valuePlaceholder, toggles = true, mono = true})` → `.getRows()`, `.setRows()`; trailing empty row, per-row on/off + remove |
| `jsonView` | `({value, depth = 2, onPick(path, value), toolbar = true, maxBytes})` → tree with fold + counts, Pretty/Raw, Copy; `onPick('$.data.status', 'approved')` when a leaf is clicked; `.setValue(v)` (string or object) |
| `splitpane` | `({left, right, id, ratio})` → `.left`, `.right` (the frame already gives you one in split layout) |
| `statusPill` | `({status, text, ms, bytes, rows, tone: 'ok'\|'info'\|'warn'\|'bad'\|'wait'\|'neutral', label})` → `● 200 OK · 182 ms · 1.2 KB` + `.update(opts)`. Helpers `httpTone(status)`, `fmtMs(ms)`, `fmtBytes(n)` |
| `methodChip` | `({method})` → mono 11/600 coloured text. `METHODS` |
| `badge` | `({text, tone: 'ok'\|'info'\|'warn'\|'bad'\|'neutral'\|'accent', icon})` → soft fill + icon + text (Pass/Fail/Blocked…) |
| `menu` | `({label, icon, variant, size, items: [{label, hint, icon, kbd, onClick, disabled} \| {group} \| '-'], align: 'left'\|'right', ariaLabel})` → dropdown + `.setItems()`, `.open()`, `.close()` |
| `advanced` | `({label, body: Node, count, open})` → `<details>` "Advanced · 2 set" + `.setCount(n)`, `.body` |
| `spinner` | `({label})` → `.start()`, `.stop()`, `.setText('3 of 12')` (the frame's `busy()` uses one) |
| `copyButton` | `({text: str \| () => str, label, size, variant})` |
| `icon` / `iconSvg` | `icon(name, {size: 14\|16\|20, label})` → `<svg>` from the vendored Lucide sprite; `iconSvg(name, size)` → markup string for `html\`${raw(iconSvg('x'))}\`` |

Core: `core/dom.js` `html\`\`` (escaping; nest `html`/`raw()`; arrays joined), `esc`, `raw`, `el(markup)`, `$`, `$$`, `download(name, blob)`, `isDark()`.
`core/i18n.js` `t(key)`, `register(ns, {en, fr})` → `T`, `pick({en, fr})`, `getLang()`, `onLangChange(fn)`, `locale()` (use with `Intl`).
`core/api.js` `api/get/post/put/del` (adds `X-Kit-Token`; throws `ApiError` with `.code` and `.status`; the message is `t('err.<code>')` when that key exists, else the server's English message — to translate your server codes, register them globally: `register('err', {en: {'http.timeout': '…'}, fr: {…}})` gives the key `err.http.timeout`), `DEMO`, `net` (`net.online`, server-offline listeners).
`core/lazy.js` `loadSqlJs()` → `SQL` (sql.js 1.14.2, wasm resolved), `loadBpmnModeler()` → `BpmnJSModeler` class, `loadBpmnViewer()`, `loadMermaid()`, `loadHljs()`, `loadMarked()`, `loadPurify()`, `loadScript(src)`, `loadCss(href)`. All vendored under `app/web/vendor/` (no CDN).
`tools/registry.js` `TOOLS` (`{id, skill, group, owner, icon, title}`), `GROUP_LABEL`, `DEMOS`, `toolMeta(id)`, `loadTool(id)`.

## 4 · CSS rules for tools

Scope everything under `.tool-<id>` in your `tool.css`. Use tokens only (no hex, no px off the scale):
`--bg --bg-subtle --surface --hover --active --selected --line --line-strong --border-field --fg --fg-2 --fg-3 (icons/placeholders only)`,
`--accent --accent-hover --accent-fg --accent-text --accent-soft --focus`, status `--ok --ok-soft --ok-solid` (+ `info`, `warn`, `bad`),
`--sans --mono`, `--fs-11 … --fs-24`, `--s-1 (4) … --s-12 (48)`, `--h-sm 28 --h-md 32 --h-lg 40`, `--r-sm 4 --r-md 6 --r-lg 10 --r-full`,
`--sh-1 --sh-2 --sh-3` (floating layers only), `--t-1 100ms --t-2 160ms --t-3 240ms --ease`.
Shared classes you can use: `.stack` (vertical 12 gap), `.row` (horizontal 8 gap, wraps), `.spacer`, `.muted`, `.mono`, `.num`,
`.section-label` (13/600 fg-2), `.sr-only`, `.panel` (the one bordered container), `.kbd`/`<kbd>`.

## 5 · Example tool (30 lines, layout split)

```js
import { register } from '../../core/i18n.js';
import strings from './i18n.js';
const T = register('demo-sum', strings);  // i18n.js: {en: {a: 'First amount', …}, fr: {a: 'Premier montant', …}}

export default {
  id: 'demo-sum', skill: 'x', icon: 'sigma', schema: 1,
  title: { en: 'Fee calculator', fr: 'Calcul de frais' }, purpose: { en: 'Interchange on one payment.', fr: 'Interchange sur un paiement.' },
  primary: { label: { en: 'Compute', fr: 'Calculer' } },
  defaults: () => ({ amount: '', rate: '0.2', note: '' }),
  samples: { en: [{ id: 'visa', label: 'Visa debit, €125.40', state: { amount: '125.40', rate: '0.2' }, autorun: true }],
             fr: [{ id: 'cb', label: 'CB débit, 125,40 €', state: { amount: '125.40', rate: '0.2' }, autorun: true }] },
  mount(el, ctx) {
    const { ui, frame } = ctx;
    const amount = frame.bindField('amount', ui.field({ label: T('amount'), required: true, input: ui.input({ value: ctx.state.amount, mono: true, onInput: (v) => ctx.setState({ amount: v }) }) }));
    const rate = ui.field({ label: T('rate'), input: ui.select({ options: ['0.2', '0.3'], value: ctx.state.rate, onChange: (v) => ctx.setState({ rate: v }) }) });
    frame.command.append(amount, rate);
    const adv = ui.advanced({ body: ui.field({ label: T('note'), input: ui.textarea({ value: ctx.state.note, onInput: (v) => ctx.setState({ note: v }) }) }), count: ctx.state.note ? 1 : 0 });
    el.append(adv);
    frame.output.append(ui.emptyState({ icon: 'sigma', text: T('empty'), sample: { label: T('load'), onClick: () => ctx.loadSample(ctx.lang, 0) } }));
  },
  validate: (s) => (+s.amount > 0 ? [] : [{ field: 'amount', message: T('errAmount') }]),  // "Enter an amount, for example 125.40"
  run: (s) => ({ fee: +(s.amount * s.rate / 100).toFixed(2) }),
  renderResult(r, ctx) { ctx.frame.output.replaceChildren(ctx.ui.table({ columns: [{ key: 'k', label: T('item') }, { key: 'v', label: T('value'), num: true }], rows: [{ k: T('fee'), v: r.fee }] })); },
  status: (r, ms) => ({ tone: 'ok', text: '1/1 ✓', ms }),
  toMarkdown: (s, r) => `# ${T('title')}\n\n| ${T('amount')} | ${s.amount} |\n|---|---|\n| ${T('fee')} | ${r ? r.fee : '—'} |\n`,
  exports: [{ id: 'csv', label: { en: 'CSV', fr: 'CSV' }, build: (s, r) => ({ name: 'fee.csv', mime: 'text/csv', text: `amount,fee\n${s.amount},${r ? r.fee : ''}\n` }) }],
  aiActions: [{ id: 'explain', label: { en: 'Explain this fee', fr: 'Expliquer ces frais' }, expects: 'markdown', prompt: (s, r) => `Explain an interchange fee of ${r && r.fee} EUR on ${s.amount} EUR.` }],
};
```

Rules of thumb: no `load()` needed if `mount` reads `ctx.state` (the frame remounts on sample load). Errors of a run: `throw new Error(T('…'))`.
Do not add your own page head, command bar, action bar, sample picker, toasts container or ⌘↵ handler: the frame owns them.
Wave-0 stubs (`viewNew(this.skill, {}, el)`) keep working in `layout: 'single'` (default when there is no `run`).

## 6 · Additions since first publication (all additive)

- **Runnable reference:** `app/web/js/shell/example-tool.js` is §5 as a real module (tabs, Advanced, validation, table + JSON view,
  exports, AI action, samples). Mount it from the console: see the comment at the top of the file.
- **Icons in the sprite** (`icon(name)` / `iconSvg(name)`; ask A to add one, do not inline other SVGs):
  house send database workflow messages-square list-ordered target clipboard-check scan-line gauge file-text book-open list-checks
  arrow-left-right grid-3x3 library timer users shield-alert key-round repeat play file-check download sparkles flask-conical eraser
  circle-alert circle-check info check x triangle-alert arrow-right arrow-up arrow-down arrow-up-right chevron-right chevron-down
  chevron-left chevron-up copy trash-2 plus search sun moon languages message-circle message-square user circle-help file-down sigma
  panel-left menu external-link refresh-cw zoom-in zoom-out maximize minimize upload paperclip pencil eye clock folder inbox wrench
  layout-grid circle circle-dot lock credit-card smartphone landmark receipt undo-2 filter filter-x settings chart-column table code
  terminal braces link wifi-off circle-x ban hourglass calendar bot lightbulb star git-branch mail printer square-check history
  file-plus files square-pen corner-down-left command keyboard log-in shield shield-check scale wallet store banknote list
  grip-vertical move square pause rotate-ccw save import share-2 layers boxes split.
- **Registry** entries also carry `icon`, `title {en, fr}` (and `desc` for the two new tools); Home and the sidebar read them, so
  your module's `title` should match.
- **`?ws=<id>`** on `#/tool/<id>` restores a workspace ("Open in tool" on a deliverable); **`?sample=en:0`** loads a sample (Home demo cards).
- **Workspace restore:** on mount the frame restores, in order: `?sample`, `?ws`, the in-tab memo (language switch), the newest saved
  workspace of the tool. So `mount()` must always build from `ctx.state`, never from `defaults()`.
- `ctx.server.put` exists. `core/api.js` throws `ApiError {code, status}`; writes carry `X-Kit-Token` automatically.
- Toasts sit above the tool action bar; menus in the action bar open upwards.

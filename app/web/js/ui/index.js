/* Every UI component, as one namespace: tools get it as ctx.ui (ctx.ui.button({...}), ctx.ui.toast('…')).
   Signatures: research/wave1-A-api.md. */
export { button, kbdLabel, IS_MAC } from './button.js';
export { field, input, textarea } from './field.js';
export { select } from './select.js';
export { segmented } from './segmented.js';
export { tabs } from './tabs.js';
export { table } from './table.js';
export { grid, FIB } from './grid.js';
export { modal } from './modal.js';
export { toast } from './toast.js';
export { emptyState } from './empty-state.js';
export { codeEditor } from './code-editor.js';
export { kvEditor } from './kv-editor.js';
export { jsonView } from './json-view.js';
export { splitpane } from './splitpane.js';
export { statusPill, httpTone, fmtMs, fmtBytes } from './status-pill.js';
export { methodChip, METHODS } from './method-chip.js';
export { badge } from './badge.js';
export { menu } from './menu.js';
export { advanced } from './advanced.js';
export { spinner } from './spinner.js';
export { copyButton } from './copy-button.js';
export { icon, iconSvg } from './icon.js';

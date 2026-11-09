/* Code editor: a <textarea> over a highlight.js layer (highlight.js 11.11.1, vendored, lazy-loaded).
   codeEditor({value, lang: 'json'|'sql'|'xml'|'bash'|'javascript'|'python'|'yaml'|'gherkin'|'', onChange(value), rows,
               readonly, placeholder, ariaLabel, lineNumbers = true}) → <div class="code-editor">.
   el.value (get/set), el.textarea, el.setLang(lang). Tab inserts two spaces; Esc then Tab leaves the editor. */
import { loadHljs } from '../core/lazy.js';

export function codeEditor({ value = '', lang = '', onChange, rows = 10, readonly = false, placeholder = '', ariaLabel = '', lineNumbers = true } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'code-editor' + (lineNumbers ? ' with-lines' : '');
  const gutter = document.createElement('div'); gutter.className = 'ce-lines'; gutter.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('div'); stage.className = 'ce-stage';
  const pre = document.createElement('pre'); pre.className = 'ce-hl'; pre.setAttribute('aria-hidden', 'true');
  const code = document.createElement('code'); pre.append(code);
  const ta = document.createElement('textarea');
  ta.className = 'ce-input'; ta.spellcheck = false; ta.rows = rows; ta.value = value;
  ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off');
  if (placeholder) ta.placeholder = placeholder;
  if (ariaLabel) ta.setAttribute('aria-label', ariaLabel);
  ta.readOnly = readonly;
  stage.append(pre, ta);
  if (lineNumbers) wrap.append(gutter);
  wrap.append(stage);
  let cur = lang, hl = null, escaped = false;
  const paint = () => {
    const v = ta.value;
    if (lineNumbers) gutter.textContent = Array.from({ length: v.split('\n').length }, (_, i) => i + 1).join('\n');
    if (hl && cur && hl.getLanguage(cur) && v.length < 200000) code.innerHTML = hl.highlight(v, { language: cur, ignoreIllegals: true }).value + '\n';
    else code.textContent = v + '\n';
    pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop;
  };
  ta.addEventListener('input', () => { paint(); if (onChange) onChange(ta.value); });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { escaped = true; return; }
    if (e.key === 'Tab' && !e.shiftKey && !escaped && !readonly) {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('  ', s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    escaped = false;
  });
  Object.defineProperty(wrap, 'value', { get: () => ta.value, set: (v) => { ta.value = v ?? ''; paint(); } });
  wrap.textarea = ta;
  wrap.setLang = (l) => { cur = l; paint(); };
  wrap.focus = () => ta.focus();
  paint();
  loadHljs().then((h) => { hl = h; paint(); }).catch(() => {});
  return wrap;
}

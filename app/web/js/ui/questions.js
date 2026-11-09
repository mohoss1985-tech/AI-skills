/* V1 guided questions of a deliverable type, and the answers shown on a deliverable. */
import { esc } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { S } from '../core/store.js';

export const qLabel = (q) => q[S.lang] || q.en;
export function questionsHtml(t, answers) {
  const qs = t.questions || [];
  if (!qs.length) return '';
  return `<div class="field"><label>${L('Quick questions')}</label><span class="help">${L('Short answers are enough. Required ones are marked *.')}</span>
    <div class="qgrid">${qs.map((q) => {
      const v = answers[q.id] || '';
      const id = 'q-' + q.id, lab = `<label for="${id}">${esc(qLabel(q))}${q.req ? ' <i class="req">*</i>' : ''}</label>`;
      if (q.kind === 'select') {
        const opts = (q.opts && (q.opts[S.lang] || q.opts.en)) || [];
        return `<div class="q">${lab}<select class="input" id="${id}" data-q="${q.id}"><option value="">—</option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
      }
      const ph = q.ph ? (q.ph[S.lang] || q.ph.en) : '';
      return `<div class="q ${q.kind === 'number' ? 'narrow' : ''}">${lab}<input class="input" id="${id}" data-q="${q.id}" type="${q.kind === 'number' ? 'number' : 'text'}" value="${esc(v)}" placeholder="${esc(ph)}" maxlength="300"></div>`;
    }).join('')}</div></div>`;
}

export function answersHtml(t, answers) {
  const rows = (t.questions || []).filter((q) => answers && answers[q.id]);
  return rows.length ? `<dl class="answers">${rows.map((q) => `<dt>${esc(qLabel(q))}</dt><dd>${esc(answers[q.id])}</dd>`).join('')}</dl>` : '';
}

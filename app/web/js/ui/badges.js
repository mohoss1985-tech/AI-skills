/* V1 badges: type colour square, deliverable status pill, Claude's avatar. */
import { L } from '../core/i18n.js';

export const sq = (t) => `<span class="sq" style="background:${t.color}"></span>`;
export const claudeMark = '<span class="avatar claude"><svg viewBox="0 0 12 12"><path d="M1 9 L4.5 3 L7 7 L9 4.5 L11 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
export const LABEL = { waiting: 'Waiting for Claude', working: 'Claude is writing', ready: 'Ready', sent: 'Sent to client' };
export const pill = (st) => `<span class="pill ${st}"><i></i>${L(LABEL[st])}</span>`;

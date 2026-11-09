/* V1 read-only demo notice. */
import { DEMO } from '../core/api.js';
import { esc } from '../core/dom.js';
import { L } from '../core/i18n.js';

export function demoNotice() {
  return `<div class="notice demo"><p><b>${L('Read-only demo.')}</b> ${L('Every tool works here in your browser, with Visa samples in English and CB samples in French. Deliverables and chat are read-only samples: creating them runs on your computer with Claude Code.')}</p>
    <a class="btn" href="${esc(DEMO.repo)}#analyst-kit-the-app" target="_blank" rel="noopener">${L('How to run it')}</a></div>`;
}

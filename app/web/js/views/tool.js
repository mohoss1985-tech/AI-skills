/* Tool screen (#/tool/:id): loads the tool module from the registry and mounts it in the tool frame. */
import { html } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { mountTool } from '../shell/tool-frame.js';
import { loadTool } from '../tools/registry.js';

const main = document.getElementById('main');

export async function viewTool(id) {
  let tool = null, err = null;
  try { tool = await loadTool(id); } catch (e) { console.error(e); err = e; }
  if (!tool) {
    main.innerHTML = html`<div class="page"><div class="page-head"><h1>${L(err ? 'This tool could not load' : 'Not found')}</h1>
      <p>${err ? L('Reload the page. If it happens again, the tool has a bug: the rest of the kit still works.') : L('There is no tool at this address.')} <a href="#/">${L('Back home')}</a></p></div></div>`;
    return null;
  }
  try { return await mountTool(main, tool); }
  catch (e) {
    console.error(e);
    main.innerHTML = html`<div class="page"><div class="page-head"><h1>${L('This tool could not load')}</h1><p>${e.message} <a href="#/">${L('Back home')}</a></p></div></div>`;
    return null;
  }
}

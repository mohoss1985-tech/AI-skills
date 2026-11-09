/* App state (V1 `S`), the 3-second refresh, and the tool Store with its two adapters:
   ServerStore (local app, /api/workspaces) and LocalStore (static demo, browser storage). */
import { api } from './api.js';
import { DEMO } from './api.js';
import { esc } from './dom.js';
import { L, getLang, setLang } from './i18n.js';
import { toast } from '../ui/toast.js';

export const S = {
  types: [], groups: [], requests: [], online: false, chatUnread: 0, profile: {}, learned: [], clients: [],
  view: null, filter: 'all', q: '', loaded: false, preset: null,
  get lang() { return getLang(); },
  set lang(v) { setLang(v); },
};

const listeners = [];
/** Run fn after every refresh (the sidebar repaints itself this way). */
export const onRefresh = (fn) => { listeners.push(fn); };

export async function refresh() {
  const prev = S.loaded ? new Map(S.requests.map((r) => [r.id, r])) : null;
  const prevChat = S.chatUnread;
  const st = await api('/api/state');
  // Samples exist per language (English: Visa rules, French: CB rules); your own deliverables always show.
  st.requests = st.requests.filter((r) => !r.is_sample || !r.lang || r.lang === S.lang);
  Object.assign(S, { types: st.types, groups: st.groups || [], requests: st.requests, online: st.claude_online, chatUnread: st.chat_unread, profile: st.profile, learned: st.learned, clients: st.clients });
  if (prev) {
    const here = location.hash;
    for (const r of S.requests) {
      const p = prev.get(r.id);
      if (p && p.status !== 'ready' && r.status === 'ready' && here !== '#/d/' + r.id) toast(`“${r.title}” ${L('is ready. Open it')}`, '#/d/' + r.id);
      else if (p && r.unread > p.unread && here !== '#/d/' + r.id) toast(`${L('Claude replied on')} “${r.title}”`, '#/d/' + r.id);
    }
    if (S.chatUnread > prevChat && here !== '#/chat') toast(L('Claude replied in your chat'), '#/chat');
  }
  S.loaded = true;
  listeners.forEach((fn) => fn());
}

// ---------- lookups on the state ----------
export const typeOf = (id) => S.types.find((t) => t.id === id) || { name: id, color: '#888', next: [] };
export const statusOf = (r) => (r.status !== 'ready' ? r.status : r.sent_at ? 'sent' : 'ready');
// Ready-made scenarios: English scenarios follow Visa rules, French ones CB rules.
export const exsOf = (t) => ((S.lang === 'fr' && t.examples_fr && t.examples_fr.length ? t.examples_fr : t.examples) || []);
export const exLabel = (e) => (S.lang === 'fr' && e.label_fr) || e.label;
export const prepared = () => {
  const p = S.profile;
  if (!p.name) return '';
  return `${L('Prepared by')} ${esc(p.name)}${p.title ? ', ' + esc(p.title) : ''}${p.company ? ' · ' + esc(p.company) : ''}`;
};

// ---------- tool workspaces ----------
/** Interface every adapter implements. A workspace is {id, tool, title, client, lang, state, schema, request_id, updated_at}.
   list(tool) returns summaries (state may be missing: call get(id) for the full workspace). */
export class Store {
  async list(tool) { return []; }
  async get(id) { return null; }
  async save(ws) { return ws; }
  async remove(id) {}
  async addRun(workspaceId, run) { return run; }
  async runs(workspaceId) { return []; }
}

/** Local app: B's /api/workspaces routes (research/wave1-B-api.md §3). */
export class ServerStore extends Store {
  async list(tool) { return (await api('/api/workspaces' + (tool ? '?tool=' + encodeURIComponent(tool) : ''))).workspaces || []; }
  async get(id) { return api('/api/workspaces/' + id); }
  async save(ws) {
    const body = JSON.stringify({ tool: ws.tool, title: ws.title, client: ws.client, lang: ws.lang, state: ws.state, schema: ws.schema });
    return ws.id ? api('/api/workspaces/' + ws.id, { method: 'PUT', body }) : api('/api/workspaces', { method: 'POST', body });
  }
  async remove(id) { await api('/api/workspaces/' + id, { method: 'DELETE' }); }
  async addRun(workspaceId, run) { return api(`/api/workspaces/${workspaceId}/runs`, { method: 'POST', body: JSON.stringify(run) }); }
  async runs(workspaceId) { return (await api(`/api/workspaces/${workspaceId}/runs`)).runs || []; }
}

/** Static demo: IndexedDB (database kit2, store kv), falling back to localStorage, then memory. Every call is
   wrapped in try/catch, so private windows and blocked storage still work for the session. */
const IDB = typeof indexedDB !== 'undefined' ? indexedDB : null;
function idbOpen() {
  return new Promise((ok, bad) => {
    try {
      const rq = IDB.open('kit2', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => bad(rq.error);
    } catch (e) { bad(e); }
  });
}
export class LocalStore extends Store {
  constructor(key = 'kit2-workspaces') { super(); this.key = key; this.mem = { seq: 0, items: {}, runs: {} }; this.db = null; }
  async idb() {
    if (this.db === null) this.db = IDB ? idbOpen().catch(() => false) : Promise.resolve(false);
    return this.db;
  }
  async read() {
    const db = await this.idb();
    if (db) {
      try {
        const v = await new Promise((ok, bad) => { const rq = db.transaction('kv').objectStore('kv').get(this.key); rq.onsuccess = () => ok(rq.result); rq.onerror = () => bad(rq.error); });
        if (v) return v;
      } catch {}
    }
    try { return JSON.parse(localStorage.getItem(this.key)) || this.mem; } catch { return this.mem; }
  }
  async write(d) {
    this.mem = d;
    const db = await this.idb();
    if (db) {
      try { await new Promise((ok, bad) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(d, this.key); tx.oncomplete = ok; tx.onerror = () => bad(tx.error); }); return; } catch {}
    }
    try { localStorage.setItem(this.key, JSON.stringify(d)); } catch {}
  }
  async list(tool) { return Object.values((await this.read()).items).filter((w) => !tool || w.tool === tool); }
  async get(id) { return (await this.read()).items[id] || null; }
  async save(ws) {
    const d = await this.read(), now = Date.now() / 1000;
    const id = ws.id || ++d.seq;
    d.items[id] = { created_at: now, ...d.items[id], ...ws, id, updated_at: now };
    await this.write(d);
    return d.items[id];
  }
  async remove(id) { const d = await this.read(); delete d.items[id]; delete d.runs[id]; await this.write(d); }
  async addRun(workspaceId, run) {
    const d = await this.read();
    const list = (d.runs[workspaceId] = d.runs[workspaceId] || []);
    const saved = { id: Date.now(), workspace_id: workspaceId, created_at: Date.now() / 1000, ...run };
    list.push(saved); d.runs[workspaceId] = list.slice(-50);
    await this.write(d);
    return saved;
  }
  async runs(workspaceId) { return ((await this.read()).runs[workspaceId] || []).slice().reverse(); }
}

/** The adapter in use: server locally, browser storage in the static demo. */
export const store = DEMO ? new LocalStore() : new ServerStore();

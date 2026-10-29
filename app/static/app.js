(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const S = { types: [], requests: [], online: false, chatUnread: 0, profile: {}, learned: [], clients: [], view: null, filter: 'all', q: '', loaded: false };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (path, opts = {}) => {
    const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
  const typeOf = (id) => S.types.find((t) => t.id === id) || { name: id, color: '#888', next: [] };
  const sq = (t) => `<span class="sq" style="background:${t.color}"></span>`;
  const date = (t) => new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = (t) => {
    const d = new Date(t * 1000), today = new Date().toDateString() === d.toDateString();
    return today ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const ago = (t) => {
    const s = Date.now() / 1000 - t;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const initials = (n) => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'You';
  const claudeMark = '<span class="avatar claude"><svg viewBox="0 0 12 12"><path d="M1 9 L4.5 3 L7 7 L9 4.5 L11 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  const statusOf = (r) => (r.status !== 'ready' ? r.status : r.sent_at ? 'sent' : 'ready');
  const LABEL = { waiting: 'Waiting for Claude', working: 'Claude is writing', ready: 'Ready', sent: 'Sent to client' };
  const pill = (st) => `<span class="pill ${st}"><i></i>${LABEL[st]}</span>`;
  const toast = (msg, href) => {
    const t = $('#toast'); t.textContent = msg; t.hidden = false; t.style.cursor = href ? 'pointer' : '';
    t.onclick = href ? () => { location.hash = href; t.hidden = true; } : null;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), href ? 5000 : 2200);
  };
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const fileName = (s) => (s || 'deliverable').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const prepared = () => {
    const p = S.profile;
    if (!p.name) return '';
    return `Prepared by ${esc(p.name)}${p.title ? ', ' + esc(p.title) : ''}${p.company ? ' · ' + esc(p.company) : ''}`;
  };

  // ---------- diagrams + markdown ----------
  function initMermaid() {
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Inter, sans-serif',
      flowchart: { curve: 'basis', padding: 12 },
      themeVariables: {
        darkMode: isDark(), fontSize: '13px', background: v('--bg'),
        primaryColor: v('--surface'), primaryTextColor: v('--fg'), primaryBorderColor: v('--line-strong'),
        lineColor: v('--muted'), textColor: v('--fg-2'), clusterBkg: v('--hover'), clusterBorder: v('--line-strong'),
        edgeLabelBackground: v('--bg'), tertiaryColor: v('--surface'), secondaryColor: v('--active'),
      },
    });
  }
  initMermaid();
  let seq = 0;
  const download = (name, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const isBpmn = (code) => code.classList.contains('language-bpmn') || /<bpmn:definitions/.test(code.textContent);
  const LEGEND = [['#e7f6ec', '#1f7a45', 'Start'], ['#e8f0fe', '#1d4ed8', 'Task'], ['#fff6e0', '#b54708', 'Decision'], ['#f1ebfb', '#6941c6', 'Wait / message'], ['#fdecec', '#b42318', 'End']];
  // Fit the diagram, but never below a readable zoom: wide processes start at the left and can be dragged.
  function readableFit(viewer, min = 0.72) {
    const c = viewer.get('canvas');
    c.zoom('fit-viewport', 'auto');
    if (c.zoom() >= min) return;
    const { inner, outer } = c.viewbox();
    c.viewbox({ x: inner.x - 16, y: inner.y + inner.height / 2 - outer.height / min / 2, width: outer.width / min, height: outer.height / min });
  }
  async function mountBpmn(container, xml, min) {
    const viewer = new BpmnJS({ container });
    await viewer.importXML(xml);
    readableFit(viewer, min);
    return viewer;
  }
  async function bpmnSvg(xml) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1400px;height:900px';
    document.body.appendChild(host);
    try { const v = await mountBpmn(host, xml, 0); const { svg } = await v.saveSVG(); v.destroy(); return svg; }
    finally { host.remove(); }
  }
  async function svgTextToPng(svgText, maxW = 620) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
    const vb = (doc.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const w = vb[2] || parseFloat(doc.getAttribute('width')) || 1200, h = vb[3] || parseFloat(doc.getAttribute('height')) || 600;
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); });
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/png'), w: Math.min(w, maxW), canvas: c };
  }
  function openFullscreen(xml, title) {
    const ov = document.createElement('div');
    ov.className = 'bpmn-full';
    ov.innerHTML = `<div class="bpmn-full-bar"><b>${esc(title || 'Process diagram')}</b><span class="spacer"></span>
      <button class="btn" data-z="in">Zoom in</button><button class="btn" data-z="out">Zoom out</button><button class="btn" data-z="fit">Fit</button>
      <button class="btn primary" data-close>Close <kbd>Esc</kbd></button></div><div class="bpmn-full-canvas"></div>`;
    document.body.appendChild(ov);
    let viewer;
    mountBpmn(ov.querySelector('.bpmn-full-canvas'), xml, 0.5).then((v) => (viewer = v));
    const close = () => { viewer && viewer.destroy(); ov.remove(); removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    ov.querySelector('[data-close]').onclick = close;
    ov.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => zoom(viewer, b.dataset.z)));
  }
  function zoom(viewer, how) {
    if (!viewer) return;
    const c = viewer.get('canvas');
    if (how === 'fit') c.zoom('fit-viewport', 'auto');
    else if (how === 'read') readableFit(viewer);
    else c.zoom(c.zoom() * (how === 'in' ? 1.25 : 0.8));
  }
  async function renderBpmnBox(box, xml) {
    box._xml = xml;
    const title = (document.querySelector('.paper-head h1') || {}).textContent || 'process';
    const base = fileName(title);
    box.innerHTML = `<div class="bpmn-tools">
        <button class="btn" data-a="full">Open full screen</button>
        <button class="btn" data-a="in" title="Zoom in">+</button><button class="btn" data-a="out" title="Zoom out">−</button><button class="btn" data-a="fit">Whole process</button>
        <span class="hint">Drag to move · pinch or ⌘+scroll to zoom</span><span class="spacer"></span>
        <button class="btn" data-a="png">PNG</button><button class="btn" data-a="svg">SVG</button><button class="btn" data-a="bpmn" title="Opens in Camunda, bpmn.io, Signavio…">.bpmn file</button></div>
      <div class="bpmn-canvas"></div>
      <div class="bpmn-legend">${LEGEND.map(([f, s, l]) => `<span><i style="background:${f};border-color:${s}"></i>${l}</span>`).join('')}
        <span class="spacer"></span><a href="https://demo.bpmn.io/new" target="_blank" rel="noopener">Edit online at bpmn.io</a></div>`;
    let viewer;
    try { viewer = await mountBpmn(box.querySelector('.bpmn-canvas'), xml); }
    catch (e) { box.innerHTML = `<pre><code>${esc(xml)}</code></pre>`; return; }
    box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'full') return openFullscreen(xml, title);
      if (['in', 'out', 'fit'].includes(a)) return zoom(viewer, a);
      if (a === 'bpmn') return download(base + '.bpmn', new Blob([xml], { type: 'application/xml' }));
      const { svg } = await viewer.saveSVG();
      if (a === 'svg') return download(base + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
      const p = await svgTextToPng(svg);
      p.canvas.toBlob((blob) => download(base + '.png', blob));
    }));
  }
  async function renderMarkdown(el, md) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(md || '', { gfm: true }));
    await Promise.all([...el.querySelectorAll('pre > code')].filter(isBpmn).map(async (code) => {
      const box = document.createElement('div');
      box.className = 'bpmn-box';
      const xml = code.textContent;
      code.parentElement.replaceWith(box);
      await renderBpmnBox(box, xml);
    }));
    await Promise.all([...el.querySelectorAll('pre > code.language-mermaid')].map(async (code) => {
      const box = document.createElement('div');
      box.className = 'mermaid-box';
      const src = code.textContent;
      code.parentElement.replaceWith(box);
      try { box.innerHTML = (await mermaid.render('m' + ++seq, src)).svg; }
      catch { box.innerHTML = `<pre><code>${esc(src)}</code></pre>`; }
    }));
  }

  // ---------- state + live updates ----------
  async function refresh() {
    const prev = S.loaded ? new Map(S.requests.map((r) => [r.id, r])) : null;
    const prevChat = S.chatUnread;
    const st = await api('/api/state');
    Object.assign(S, { types: st.types, requests: st.requests, online: st.claude_online, chatUnread: st.chat_unread, profile: st.profile, learned: st.learned, clients: st.clients });
    if (prev) {
      const here = location.hash;
      for (const r of S.requests) {
        const p = prev.get(r.id);
        if (p && p.status !== 'ready' && r.status === 'ready' && here !== '#/d/' + r.id) toast(`“${r.title}” is ready. Open it`, '#/d/' + r.id);
        else if (p && r.unread > p.unread && here !== '#/d/' + r.id) toast(`Claude replied on “${r.title}”`, '#/d/' + r.id);
      }
      if (S.chatUnread > prevChat && here !== '#/chat') toast('Claude replied in your chat', '#/chat');
    }
    S.loaded = true;
    renderChrome();
  }
  function renderChrome() {
    $('#type-nav').innerHTML = S.types.map((t) => {
      const n = S.requests.filter((r) => r.type === t.id).length;
      return `<a class="nav-item" href="#/type/${t.id}" data-nav="${t.id}">${sq(t)}${esc(t.name)}<span class="count">${n || ''}</span></a>`;
    }).join('');
    const newCount = S.requests.filter((r) => r.unseen || r.unread).length;
    $('#home-badge').textContent = newCount ? newCount + ' new' : '';
    const cb = $('#chat-badge'); cb.hidden = !S.chatUnread; cb.textContent = S.chatUnread;
    const total = newCount + S.chatUnread;
    document.title = (total ? `(${total}) ` : '') + 'Analyst Kit';
    $('#me-name').textContent = S.profile.name || 'Set up your profile';
    $('#me-avatar').textContent = initials(S.profile.name);
    const p = $('#presence');
    p.className = 'presence' + (S.online ? ' on' : '');
    $('#presence-label').textContent = S.online ? 'Claude is online' : 'Claude is offline';
    p.title = S.online ? 'Requests and messages are picked up automatically' : 'Type "check my requests" in your Claude chat';
    const r = location.hash.replace(/^#/, '') || '/';
    const sel = r === '/' ? 'home' : r.startsWith('/chat') ? 'chat' : r.startsWith('/profile') ? 'profile' : (r.match(/^\/type\/([a-z-]+)/) || [])[1];
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === sel));
  }
  setInterval(async () => {
    try { await refresh(); if (S.view && S.view.tick) await S.view.tick(); } catch {}
  }, 3000);

  // ---------- shared pieces ----------
  function listHtml(reqs) {
    if (!reqs.length) return `<div class="list"><div class="empty-note">Nothing here.</div></div>`;
    return `<div class="list">${reqs.map((r) => {
      const t = typeOf(r.type);
      const flag = r.unseen || r.unread ? '<span class="newdot" title="New"></span>' : '';
      const reply = r.awaiting_reply ? '<span class="pill waiting"><i></i>Claude is replying</span>' : '';
      return `<a class="item" href="#/d/${r.id}">${sq(t)}
        <span style="min-width:0"><div class="name">${esc(r.title)}</div><div class="sub">${esc(t.name)}${r.client ? ' · ' + esc(r.client) : ''}</div></span>
        <span class="flags">${flag}${reply || pill(statusOf(r))}</span><span class="when">${ago(r.updated_at)}</span></a>`;
    }).join('')}</div>`;
  }

  function messageHtml(m) {
    if (m.role === 'claude') return `<div class="msg">${claudeMark}<div><div class="who">Claude <time>${time(m.created_at)}</time></div><div class="body md" data-md="${m.id}"></div></div></div>`;
    return `<div class="msg user"><span class="avatar">${esc(initials(S.profile.name))}</span><div><div class="who">${esc(S.profile.name || 'You')} <time>${time(m.created_at)}</time></div><div class="body">${esc(m.body)}</div></div></div>`;
  }
  async function paintFeed(feed, msgs, emptyHtml) {
    const waiting = msgs.length && msgs[msgs.length - 1].role === 'user';
    feed.innerHTML = (msgs.length ? msgs.map(messageHtml).join('') : emptyHtml) +
      (waiting ? `<div class="typing"><i></i><i></i><i></i>${S.online ? 'Claude is replying…' : 'Claude will reply when you say “check my requests” in your chat'}</div>` : '');
    for (const m of msgs.filter((x) => x.role === 'claude')) await renderMarkdown(feed.querySelector(`[data-md="${m.id}"]`), m.body);
    feed.scrollTop = feed.scrollHeight;
  }
  function wireComposer(root, send) {
    const ta = $('textarea', root), btn = $('[data-send]', root);
    const clear = () => { try { sessionStorage.removeItem('draft:' + location.hash); } catch {} };
    const go = async () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      btn.disabled = true;
      try { await send(text); ta.value = ''; clear(); } catch (e) { toast(e.message); }
      btn.disabled = false; ta.focus();
    };
    btn.onclick = go;
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } });
    root.querySelectorAll('[data-quick]').forEach((b) => (b.onclick = () => {
      const q = b.dataset.quick;
      if (q.endsWith(':')) { ta.value = q + ' '; ta.focus(); } else { ta.value = q; go(); }
    }));
    try { ta.value = sessionStorage.getItem('draft:' + location.hash) || ''; } catch {}
    ta.addEventListener('input', () => { try { sessionStorage.setItem('draft:' + location.hash, ta.value); } catch {} });
  }

  // ---------- views ----------
  function viewHome() {
    const p = S.profile;
    main.innerHTML = `<div class="page">
      <div class="page-head hello"><div><h1>${p.name ? `${greeting()}, ${esc(p.name.split(' ')[0])}` : 'What do you need for your client?'}</h1>
        <p>Paste your notes, Claude writes the deliverable, you hand it over.</p></div></div>
      <form class="ask" id="ask"><input id="ask-input" placeholder="Ask Claude anything: prepare a workshop, review a doc, draft a client email…" autocomplete="off"><button class="btn primary" type="submit">Ask</button></form>
      ${!p.name ? `<div class="notice"><p>Add your name and company so every document says “Prepared by you”, and tell Claude how you like to work.</p><a class="btn" href="#/profile">Set up profile</a></div>` : ''}
      <div><h2 class="section-title">Start a deliverable</h2><div class="types compact">${S.types.map((t) => `
        <div class="type" data-href="#/new/${t.id}" title="You give: ${esc(t.gives)}"><div class="t">${sq(t)}${esc(t.name)}</div><p>${esc(t.gets)}</p></div>`).join('')}</div></div>
      <div><h2 class="section-title">Your deliverables</h2>
        <div class="toolbar"><input class="input" id="q" placeholder="Search by title or client" value="${esc(S.q)}"><div class="chips" id="filters"></div></div>
        <div id="list"></div></div>
    </div>`;
    const paint = () => {
      const counts = { all: S.requests.length, progress: 0, ready: 0, sent: 0 };
      S.requests.forEach((r) => { const s = statusOf(r); if (s === 'sent') counts.sent++; else if (s === 'ready') counts.ready++; else counts.progress++; });
      const F = [['all', 'All'], ['progress', 'In progress'], ['ready', 'Ready to send'], ['sent', 'Sent to client']];
      $('#filters').innerHTML = F.map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${l}<span class="n">${counts[k]}</span></button>`).join('');
      const q = S.q.toLowerCase();
      const rows = S.requests.filter((r) => {
        const s = statusOf(r);
        const okF = S.filter === 'all' || (S.filter === 'progress' ? s === 'waiting' || s === 'working' : s === S.filter);
        return okF && (!q || (r.title + ' ' + r.client + ' ' + typeOf(r.type).name).toLowerCase().includes(q));
      });
      $('#list').innerHTML = listHtml(rows);
    };
    paint();
    $('#filters').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { S.filter = b.dataset.f; paint(); } };
    $('#q').oninput = (e) => { S.q = e.target.value; paint(); };
    $('#ask').onsubmit = async (e) => {
      e.preventDefault();
      const text = $('#ask-input').value.trim();
      if (!text) return;
      await post('/api/chat', { body: text }); location.hash = '#/chat';
    };
    return { tick: paint };
  }

  function viewType(id) {
    const t = typeOf(id);
    const reqs = S.requests.filter((r) => r.type === id);
    main.innerHTML = `<div class="page">
      <div class="page-head"><div class="crumb"><a href="#/">Home</a><span>›</span><span>${esc(t.name)}</span></div>
        <h1>${esc(t.name)}</h1><p>You give: ${esc(t.gives.toLowerCase())}. You get: ${esc(t.gets.toLowerCase())}.</p></div>
      <div><a class="btn primary big" href="#/new/${id}">New ${esc(t.name)}</a></div>
      ${tryHtml(t)}
      <div><h2 class="section-title">All ${esc(t.name)} deliverables <span class="count">${reqs.length}</span></h2><div id="list">${listHtml(reqs)}</div></div>
    </div>`;
    wireTry(main, t);
    return { tick: () => { $('#list').innerHTML = listHtml(S.requests.filter((r) => r.type === id)); } };
  }

  // Ready-made scenarios: open the finished sample, or start a new deliverable from realistic notes.
  function tryHtml(t) {
    const samples = S.requests.filter((r) => r.is_sample && r.type === t.id).sort((a, b) => a.id - b.id);
    const ex = (t.examples || []).filter((e) => e.notes);
    if (!samples.length && !ex.length) return '';
    return `<div><h2 class="section-title">Try it</h2><div class="try">
      ${samples.map((s) => `<a class="try-card sample" href="#/d/${s.id}"><span class="tag">Finished sample</span><b>${esc(s.title)}</b><span>${esc(s.client)}</span></a>`).join('')}
      ${ex.map((e, i) => `<button type="button" class="try-card" data-ex="${i}"><span class="tag">Scenario</span><b>${esc(e.label)}</b><span>${esc(e.notes.slice(0, 110))}…</span></button>`).join('')}
    </div></div>`;
  }
  function wireTry(root, t) {
    root.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => startExample(t.id, +b.dataset.ex)));
  }
  function startExample(typeId, i) {
    const e = (typeOf(typeId).examples || [])[i];
    if (!e) return;
    S.preset = { type: typeId, title: e.title, client: e.client, notes: e.notes };
    if (location.hash === '#/new/' + typeId) route(); else location.hash = '#/new/' + typeId;
  }

  function viewNew(typeId, preset = {}) {
    let type = typeId || S.types[0].id;
    main.innerHTML = `<div class="page">
      <div class="page-head"><div class="crumb"><a href="#/">Home</a><span>›</span><span>New deliverable</span></div>
        <h1>New deliverable</h1><p>Rough notes are fine. Claude asks in the chat if something is missing.</p></div>
      <form class="form" id="new-form" autocomplete="off">
        <div class="field"><label>What do you need?</label><div class="seg" id="seg"></div></div>
        <div class="expect" id="expect"></div>
        <div class="two">
          <div class="field"><label for="f-client">Client or project</label><input class="input" id="f-client" list="client-list" placeholder="e.g. Northwind Retail">
            <datalist id="client-list">${S.clients.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label for="f-title">Title</label><input class="input" id="f-title" placeholder="e.g. Invoice approval process"></div>
        </div>
        <div class="field"><label for="f-notes">Your notes</label>
          <textarea class="textarea" id="f-notes"></textarea>
          <span class="help">Paste anything: meeting notes, an email thread, a spec. You can also drop a .txt, .md or .csv file into the box.</span></div>
        <div class="form-foot">
          <div class="left"><span class="ex-label">Try a scenario:</span><div class="chips" id="f-examples"></div></div>
          <div style="display:flex;align-items:center;gap:12px"><span class="err" id="f-err"></span><button class="btn primary big" type="submit">Create deliverable <kbd>⌘↵</kbd></button></div>
        </div>
      </form></div>`;
    const paint = () => {
      const t = typeOf(type);
      $('#seg').innerHTML = S.types.map((x) => `<button type="button" data-t="${x.id}" class="${x.id === type ? 'on' : ''}">${sq(x)}${esc(x.name)}</button>`).join('');
      $('#expect').innerHTML = `<b>You'll get:</b> ${esc(t.gets)}.`;
      $('#f-notes').placeholder = t.placeholder;
      $('#f-examples').innerHTML = (t.examples || []).filter((e) => e.notes).map((e, i) => `<button type="button" class="chip" data-ex="${i}">${esc(e.label)}</button>`).join('');
    };
    paint();
    $('#f-client').value = preset.client || S.clients[0] || '';
    $('#f-title').value = preset.title || '';
    $('#f-notes').value = preset.notes || '';
    $('#seg').onclick = (e) => { const b = e.target.closest('button'); if (b) { type = b.dataset.t; paint(); } };
    $('#f-examples').onclick = (e) => {
      const b = e.target.closest('[data-ex]');
      if (!b) return;
      const ex = typeOf(type).examples[+b.dataset.ex];
      $('#f-notes').value = ex.notes;
      if (ex.title) $('#f-title').value = ex.title;
      if (ex.client) $('#f-client').value = ex.client + ' (sample)';
    };
    const ta = $('#f-notes');
    ta.addEventListener('dragover', (e) => e.preventDefault());
    ta.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      const rd = new FileReader();
      rd.onload = () => { ta.value = (ta.value ? ta.value + '\n\n' : '') + rd.result; if (!$('#f-title').value) $('#f-title').value = f.name.replace(/\.\w+$/, ''); };
      rd.readAsText(f);
    });
    const submit = async () => {
      try {
        const { id } = await post('/api/requests', { type, client: $('#f-client').value, title: $('#f-title').value, notes: ta.value });
        location.hash = '#/d/' + id;
      } catch (err) { $('#f-err').textContent = err.message; }
    };
    $('#new-form').onsubmit = (e) => { e.preventDefault(); submit(); };
    $('#new-form').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } });
    setTimeout(() => (preset.notes ? $('#f-title') : ta).focus(), 0);
    return null;
  }

  async function viewDeliverable(id) {
    let r;
    try { r = await api('/api/requests/' + id); } catch { main.innerHTML = `<div class="page"><div class="page-head"><h1>Not found</h1><p><a href="#/">Back home</a></p></div></div>`; return null; }
    const t = typeOf(r.type);
    let shownVersion = null;
    main.innerHTML = `<div class="page wide">
      <div class="crumb"><a href="#/">Home</a><span>›</span><a href="#/type/${t.id}">${esc(t.name)}</a>${r.client ? `<span>›</span><span>${esc(r.client)}</span>` : ''}</div>
      <div class="split">
        <div class="left">
          <div id="actions"></div>
          <article class="paper"><header class="paper-head">
            <span class="kind">${sq(t)}${esc(t.name)}</span><h1>${esc(r.title)}</h1>
            <span class="meta">${r.client ? esc(r.client) + ' · ' : ''}<span id="doc-date">${date(r.updated_at)}</span></span>
            ${prepared() ? `<span class="prepared">${prepared()}</span>` : ''}
          </header><div id="doc"></div></article>
          <div id="next"></div>
          <details class="box"><summary>Your original notes</summary><div class="inner"><div class="notes">${esc(r.notes)}</div></div></details>
          <div><button class="btn ghost" id="a-del">Delete this deliverable</button></div>
        </div>
        <aside class="panel" id="panel">
          <div class="panel-head">Conversation<span>⌘↵ to send</span></div>
          <div class="feed" id="feed"></div>
          <div class="composer" id="composer">
            <div class="quick" id="quick"></div>
            <textarea placeholder="Ask a question, give feedback, or request changes…"></textarea>
            <div class="row"><span class="hint">Claude updates the document when you ask for changes.</span><button class="btn primary" data-send>Send</button></div>
          </div>
        </aside>
      </div></div>`;

    const paintActions = () => {
      const ready = r.status === 'ready';
      const vers = r.versions.length;
      $('#actions').innerHTML = ready ? `<div class="doc-actions">
          <button class="btn primary" id="a-word">Download Word</button>
          <button class="btn" id="a-pdf">Save as PDF</button>
          <button class="btn" id="a-copy">Copy</button>
          <button class="btn" id="a-sent">${r.sent_at ? '✓ Sent to client' : 'Mark as sent'}</button>
          <span class="spacer"></span>
          ${vers ? `<span class="verbar">Version <select id="ver">${r.versions.map((v, i) => `<option value="${v.id}">${i + 1} · ${time(v.created_at)}</option>`).join('')}<option value="" selected>${vers + 1} · latest</option></select></span>` : ''}
          ${pill(statusOf(r))}</div>` : '';
      if (!ready) return;
      $('#a-pdf').onclick = () => window.print();
      $('#a-word').onclick = () => downloadWord(r, t, shownVersion);
      $('#a-copy').onclick = () => copyRich(r, shownVersion);
      $('#a-sent').onclick = async () => { await post(`/api/requests/${r.id}/sent`, { sent: !r.sent_at }); r.sent_at = r.sent_at ? null : Date.now() / 1000; paintActions(); toast(r.sent_at ? 'Marked as sent to client' : 'Marked as not sent'); };
      const ver = $('#ver');
      if (ver) ver.onchange = async () => {
        shownVersion = ver.value ? (await api('/api/versions/' + ver.value)).output : null;
        paintDoc();
      };
    };
    const paintDoc = async () => {
      const doc = $('#doc');
      if (r.status !== 'ready') {
        doc.innerHTML = `<div class="working"><div class="spinner"></div>
          <h2>${r.status === 'working' ? 'Claude is writing this now' : 'Waiting for Claude'}</h2>
          <p>${S.online ? 'Claude has it and will start in a moment. You can add context in the conversation while you wait.' : 'Type <b>“check my requests”</b> in your Claude chat. This page updates by itself.'}</p></div>`;
        return;
      }
      doc.innerHTML = (shownVersion ? `<div class="old-note">You're viewing an earlier version. Downloads use this version. Pick “latest” to go back.</div>` : '') + '<div class="md" id="out"></div>';
      await renderMarkdown($('#out'), shownVersion || r.output);
    };
    const paintNext = () => {
      const nx = (t.next || []).map(typeOf);
      $('#next').innerHTML = r.status === 'ready' && nx.length ? `<div class="next"><h2 class="section-title">Continue from this document</h2>
        <div class="chips">${nx.map((n) => `<button class="chip" data-next="${n.id}">${sq(n)}Create ${esc(n.name)}</button>`).join('')}</div></div>` : '';
      $('#next').querySelectorAll('[data-next]').forEach((b) => (b.onclick = () => {
        S.preset = { type: b.dataset.next, client: r.client, title: r.title, notes: `Based on the ${t.name} “${r.title}”:\n\n${r.output}` };
        location.hash = '#/new/' + b.dataset.next;
      }));
    };
    const QUICK = r.status === 'ready'
      ? ['Make it shorter', 'Add more detail', 'Make it more formal for the client', 'Translate to French', 'What questions should I ask the client?']
      : ['Here is more context:', 'Make it a one-pager'];
    $('#quick').innerHTML = QUICK.map((q) => `<button data-quick="${esc(q)}">${esc(q)}</button>`).join('');
    const feed = $('#feed');
    const empty = `<div class="feed-empty"><b>Talk to Claude about this document</b><span>Ask why something is there, give feedback, or request changes. Claude answers here and updates the document.</span></div>`;
    paintActions(); paintNext(); await paintDoc(); await paintFeed(feed, r.messages, empty);
    wireComposer($('#composer'), async (text) => {
      await post(`/api/requests/${r.id}/messages`, { body: text });
      r = await api('/api/requests/' + id); await paintFeed(feed, r.messages, empty);
    });
    const del = $('#a-del');
    del.onclick = async () => {
      if (!del.dataset.armed) { del.dataset.armed = 1; del.textContent = 'Click again to delete'; return; }
      await api('/api/requests/' + r.id, { method: 'DELETE' }); toast('Deleted'); location.hash = '#/';
    };

    return {
      tick: async () => {
        const fresh = await api('/api/requests/' + id);
        const docChanged = fresh.updated_at !== r.updated_at || fresh.status !== r.status;
        const msgsChanged = fresh.messages.length !== r.messages.length;
        r = fresh;
        if (docChanged) {
          shownVersion = null; paintActions(); paintNext(); await paintDoc(); $('#doc-date').textContent = date(r.updated_at);
          if (r.status === 'ready') toast(r.versions.length ? 'Document updated' : 'Your document is ready');
        }
        if (msgsChanged || docChanged) await paintFeed(feed, r.messages, empty);
      },
    };
  }

  async function viewChat() {
    main.innerHTML = `<div class="chatpage">
      <div class="head"><h1>Chat with Claude</h1><p>Anything that isn't a deliverable: prep a workshop, review a document, plan your week, draft a client email.</p></div>
      <div class="feed" id="feed"></div>
      <div class="composer" id="composer">
        <textarea placeholder="Message Claude…"></textarea>
        <div class="row"><span class="hint">⌘↵ to send</span><button class="btn primary" data-send>Send</button></div>
      </div></div>`;
    const SUG = [
      ['Prepare a client workshop', 'Agenda, questions and exercises for a 90-minute discovery workshop'],
      ['Draft a cover email', 'A short email sending the latest deliverable to my client'],
      ['Review my document', "I'll paste a PRD or story. Tell me what's weak"],
      ['Prepare me for an interview', 'Mock product owner interview questions with strong answers'],
    ];
    const empty = `<div class="feed-empty"><b>Start with one of these, or write your own.</b><div class="suggest">${SUG.map(([a, b]) => `<button data-s="${esc(a + ': ' + b)}"><b>${esc(a)}</b>${esc(b)}</button>`).join('')}</div></div>`;
    const feed = $('#feed');
    let msgs = (await api('/api/chat')).messages;
    await paintFeed(feed, msgs, empty);
    const send = async (text) => { await post('/api/chat', { body: text }); msgs = (await api('/api/chat')).messages; await paintFeed(feed, msgs, empty); };
    wireComposer($('#composer'), send);
    feed.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { const ta = $('#composer textarea'); ta.value = b.dataset.s; ta.focus(); } });
    $('#composer textarea').focus();
    return {
      tick: async () => {
        const fresh = (await api('/api/chat')).messages;
        if (fresh.length !== msgs.length) { msgs = fresh; await paintFeed(feed, msgs, empty); }
        else if (msgs.length && msgs[msgs.length - 1].role === 'user') await paintFeed(feed, msgs, empty);
      },
    };
  }

  function viewProfile() {
    const p = S.profile;
    let learned = [...S.learned];
    const opt = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    main.innerHTML = `<div class="page">
      <div class="page-head"><div class="crumb"><a href="#/">Home</a><span>›</span><span>Your profile</span></div>
        <h1>Your profile</h1><p>Claude reads this before writing anything for you. Your name and company appear on every document.</p></div>
      <form class="form" id="pf">
        <div class="two">
          <div class="field"><label for="p-name">Your name</label><input class="input" id="p-name" value="${esc(p.name)}" placeholder="e.g. Sam Rivera"></div>
          <div class="field"><label for="p-title">Your title</label><input class="input" id="p-title" value="${esc(p.title)}" placeholder="e.g. Senior Product Owner"></div>
        </div>
        <div class="two">
          <div class="field"><label for="p-company">Company or brand</label><input class="input" id="p-company" value="${esc(p.company)}" placeholder="e.g. Rivera Product Consulting"><span class="help">Shown as “Prepared by …” on documents.</span></div>
          <div class="field"><label for="p-tool">Backlog tool your clients use</label><select class="input" id="p-tool">${opt(['Jira', 'Linear', 'Azure DevOps', 'Trello', 'Other'], p.tool)}</select></div>
        </div>
        <div class="two">
          <div class="field"><label for="p-language">Document language</label><select class="input" id="p-language">${opt(['English', 'French', 'Arabic', 'Spanish', 'German', 'Dutch'], p.language)}</select></div>
          <div class="field"><label for="p-tone">Writing style</label><select class="input" id="p-tone">${opt(['Clear and concise', 'Formal for executives', 'Detailed for developers', 'Friendly'], p.tone)}</select></div>
        </div>
        <div class="field"><label>What Claude has learned about how you work</label>
          <span class="help">Claude adds notes here from your feedback, so you don't repeat yourself. Remove anything that's wrong.</span>
          <div class="learned" id="learned"></div></div>
        <div class="form-foot"><span></span><button class="btn primary big" type="submit">Save profile</button></div>
      </form></div>`;
    const paintLearned = () => {
      $('#learned').innerHTML = learned.length
        ? `<ul>${learned.map((l, i) => `<li><span>${esc(l)}</span><button type="button" class="btn ghost" data-rm="${i}">Remove</button></li>`).join('')}</ul>`
        : '<div class="expect">Nothing yet. As you give feedback in conversations, Claude notes your preferences here.</div>';
      $('#learned').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { learned.splice(+b.dataset.rm, 1); paintLearned(); }));
    };
    paintLearned();
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      const v = (k) => $('#p-' + k).value;
      await post('/api/profile', { name: v('name'), title: v('title'), company: v('company'), tool: v('tool'), language: v('language'), tone: v('tone'), learned });
      await refresh(); toast('Profile saved');
    };
    return null;
  }

  // ---------- exports ----------
  async function svgToPng(svg) {
    const xml = new XMLSerializer().serializeToString(svg);
    const box = svg.viewBox.baseVal;
    const w = box && box.width ? box.width : 800, h = box && box.height ? box.height : 400;
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/png'), w: Math.min(w, 620) };
  }
  // The client copy always uses light colours, with diagrams turned into images.
  async function clientHtml(md) {
    const root = document.documentElement, prev = root.dataset.theme;
    root.dataset.theme = 'light'; initMermaid();
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:absolute;left:-9999px;top:0;width:820px';
    document.body.appendChild(tmp);
    await renderMarkdown(tmp, md);
    for (const box of tmp.querySelectorAll('.bpmn-box')) {
      try { const p = await svgTextToPng(await bpmnSvg(box._xml)); box.outerHTML = `<p><img src="${p.src}" width="${Math.round(p.w)}"></p>`; } catch {}
    }
    for (const box of tmp.querySelectorAll('.mermaid-box')) {
      const svg = box.querySelector('svg');
      if (!svg) continue;
      try { const p = await svgToPng(svg); box.outerHTML = `<p><img src="${p.src}" width="${Math.round(p.w)}"></p>`; } catch {}
    }
    const html = tmp.innerHTML;
    tmp.remove();
    if (prev) root.dataset.theme = prev; else delete root.dataset.theme;
    initMermaid();
    return html;
  }
  async function downloadWord(r, t, version) {
    toast('Preparing the Word file…');
    const body = await clientHtml(version || r.output);
    const by = prepared();
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
      <style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1b1c20;line-height:1.45}h1{font-size:20pt;margin:0 0 4pt}h2{font-size:15pt;margin:16pt 0 6pt}h3{font-size:12.5pt;margin:14pt 0 4pt}
      table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}th,td{border:1px solid #d6d8de;padding:4pt 6pt;vertical-align:top;font-size:10pt}th{background:#f4f5f7;text-align:left}
      pre{background:#f4f5f7;border:1px solid #e5e6ea;padding:8pt;font-family:Consolas,monospace;font-size:9pt;white-space:pre-wrap}code{font-family:Consolas,monospace;font-size:9.5pt}.meta{color:#6b6f78;margin:0 0 2pt}</style></head>
      <body><p style="color:#6b6f78;text-transform:uppercase;letter-spacing:1px;font-size:9pt">${esc(t.name)}</p><h1>${esc(r.title)}</h1>
      <p class="meta">${r.client ? esc(r.client) + ' · ' : ''}${date(r.updated_at)}</p>${by ? `<p class="meta">${by}</p>` : ''}<hr>${body}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', doc], { type: 'application/msword' }));
    a.download = fileName((r.client ? r.client + ' ' : '') + r.title) + '.doc';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Word file downloaded');
  }
  async function copyRich(r, version) {
    const md = version || r.output;
    try {
      const html = await clientHtml(md);
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([`<h1>${esc(r.title)}</h1>${html}`], { type: 'text/html' }),
        'text/plain': new Blob([md], { type: 'text/plain' }),
      })]);
      toast('Copied. Paste it into an email, Word, Notion or Confluence');
    } catch {
      try { await navigator.clipboard.writeText(md); toast('Copied as text'); } catch { toast("Couldn't copy"); }
    }
  }

  // ---------- router ----------
  async function route() {
    S.view = null;
    await refresh();
    const r = location.hash.replace(/^#/, '') || '/';
    let m;
    if ((m = r.match(/^\/d\/(\d+)/))) S.view = await viewDeliverable(+m[1]);
    else if ((m = r.match(/^\/new(?:\/([a-z-]+))?/))) { const pre = S.preset && S.preset.type === m[1] ? S.preset : {}; S.preset = null; S.view = viewNew(m[1], pre); }
    else if ((m = r.match(/^\/type\/([a-z-]+)/))) S.view = viewType(m[1]);
    else if (r.startsWith('/chat')) S.view = await viewChat();
    else if (r.startsWith('/profile')) S.view = viewProfile();
    else S.view = viewHome();
    main.scrollTop = 0;
  }
  window.Kit = {
    state: S, typeOf, startExample, toast, esc,
    ask: async (text) => { await post('/api/chat', { body: text }); },
    fill: (i) => { const b = document.querySelector(`#f-examples [data-ex="${i}"]`); if (b) { b.click(); return true; } return false; },
  };
  addEventListener('hashchange', route);
  main.addEventListener('click', (e) => { const c = e.target.closest('[data-href]'); if (c) location.hash = c.dataset.href; });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n') { e.preventDefault(); location.hash = '#/new'; }
    if (e.key === '/') { const q = $('#q') || $('#ask-input'); if (q) { e.preventDefault(); q.focus(); } }
  });
  $('#theme-btn').onclick = () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('kit-theme', next); } catch {}
    initMermaid(); route();
  };
  route();
})();

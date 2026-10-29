/* Guide: an instant help chatbot that knows the app, every skill and the jargon.
   Runs in the browser, no API key. Anything it can't answer goes to Claude in the chat. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const K = () => window.Kit;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%?+ ]+/g, ' ');

  // ---------- what the guide knows about each skill ----------
  const SKILLS = {
    'prioritizing-ai-use-cases': {
      keys: ['roadmap', 'prioritis', 'prioritiz', 'use case', 'which first', 'backlog of ideas', 'value', 'feasibility', 'quarter', 'now next later', 'business case', 'roi'],
      paste: '- The **candidate use cases** (what customers ask for)\n- **Monthly volumes** per use case, even rough ones\n- **Where the answer lives** today (article, PDF, system, API)\n- **Constraints**: regulated topics, budget ("2 use cases per quarter"), cost per call',
      tips: '- Volumes matter most: without them the scoring is a guess.\n- Say which topics are **regulated** (complaints, advice, disputes). The skill gates them out instead of scoring them.\n- Mention the **cost per contact** to get a business impact estimate.',
      when: 'deciding **what the assistant should handle first** and building a Now / Next / Later roadmap',
    },
    'designing-conversational-journeys': {
      keys: ['journey', 'conversation', 'dialog', 'utterance', 'intent', 'hand off', 'handoff', 'escalat', 'fallback', 'chatbot flow', 'bot flow', 'branches', 'happy path'],
      paste: '- The **customer need** in one sentence\n- What **"solved"** means\n- The **approved articles** or data the assistant can use\n- What it **must not do** (act on the account, give advice…)\n- When to **hand off** to a person, and to which team',
      tips: '- Describe the **unhappy paths**: fraud, failure, frustration, no source. That is where journeys break.\n- Name the hand-off team and its hours.\n- Paste a few **real customer messages**: typos and panic included.',
      when: 'designing **how one conversation behaves**, with every branch and the hand-off to an advisor',
    },
    'evaluating-rag-quality': {
      keys: ['evaluat', 'test set', 'golden', 'quality', 'good enough', 'go live', 'go no go', 'go/no-go', 'release gate', 'metric', 'faithful', 'hallucinat', 'rag', 'retrieval', 'monitor', 'csv', 'score', 'judge'],
      paste: '- **Before testing:** the use cases, the knowledge sources and the risks. You get a plan, a golden set and release gates.\n- **After testing:** paste the **scored CSV** (one row per question, 1 = pass, 0 = fail). You get go / no-go and the failure analysis.\n- **After launch:** what changed in the numbers. You get a monitoring dashboard and an investigation plan.',
      tips: '- Agree the **release gates before** you look at results.\n- Mix the golden set: answerable, escalation, unanswerable, adversarial. Take 30% from **real conversations**.\n- Add a `failure_cause` column so each failure goes to the right owner.',
      when: 'deciding **if the answers are good enough to release**, and monitoring them after',
    },
    'governing-ai-risk': {
      keys: ['risk', 'guardrail', 'security', 'complian', 'legal', 'gdpr', 'rgpd', 'dpo', 'ai act', 'dora', 'owasp', 'injection', 'red team', 'jailbreak', 'privacy', 'personal data'],
      paste: '- What the assistant **sees** (customer data, notes, documents)\n- What it **does** (answers only, drafts, actions on the account)\n- **Who** uses it (customers, advisors) and how they log in\n- The **model provider** and where it is hosted',
      tips: '- Be precise about **actions**: "can block a card" changes the risk level a lot.\n- Mention any **sensitive data** (health, free-text notes).\n- Legal points come back as questions to confirm with Legal, the DPO and Compliance, never as legal advice.',
      when: 'listing **what could go wrong**, the guardrails, red-team tests and the compliance questions',
    },
    'curating-knowledge-bases': {
      keys: ['knowledge', 'content', 'article', 'help centre', 'help center', 'faq', 'source', 'outdated', 'contradict', 'writer', 'documentation base', 'metadata', 'cant answer', 'missing'],
      paste: '- Your **content sources**, owners and last review dates\n- The **top customer questions** with volumes\n- Known problems: outdated pages, PDFs, pages that **contradict** each other\n- Or the **assistant logs**: questions it couldn\'t answer or got 👎 on',
      tips: '- Logs of "I can\'t answer" and 👎 are the best input: they rank gaps by real demand.\n- Say how many **writers** you have, to get a backlog that fits capacity.',
      when: 'fixing the **content the assistant answers from**: gaps, contradictions, writing standards',
    },
    'aligning-stakeholders': {
      keys: ['steerco', 'steering', 'committee', 'decision', 'memo', 'raci', 'release note', 'stakeholder', 'brief', 'change management', 'adoption', 'communicat', 'sponsor', 'arbitrage', 'go live pack'],
      paste: '- **What** needs deciding or communicating, **to whom**, and **by when**\n- The **options** and the key numbers\n- **Who thinks what** (support in favour, marketing against…)',
      tips: '- Name the **decision** in one sentence: the memo is built around it.\n- Give the cost of **not deciding** (a lost slot, a delay).\n- Ask for several artefacts at once: release notes + briefing + RACI.',
      when: 'getting a **decision or alignment**: decision memo, steerco update, RACI, release notes, change plan',
    },
    'modeling-processes': {
      keys: ['process', 'bpmn', 'diagram', 'flowchart', 'swimlane', 'sop', 'procedure', 'workflow', 'uml', 'map'],
      paste: '- **Who** does each step (roles or teams)\n- The steps **in order**\n- **Decisions** and what happens in each case\n- What happens **when something goes wrong**',
      tips: '- Meeting notes are fine: the skill lists the open questions to ask the client.\n- Download the `.bpmn` file to edit it in Camunda Modeler or bpmn.io.',
      when: 'turning a process description into a **BPMN diagram** with swimlanes',
    },
    'writing-prds': {
      keys: ['prd', 'requirement', 'spec', 'product requirement', 'one pager', 'brief', 'feature'],
      paste: '- The **problem** and who has it\n- Any **numbers** (volumes, costs, complaints)\n- **Deadlines** and what is **out of scope**',
      tips: '- Evidence makes the PRD credible: paste a metric or a quote.\n- Say if you want a one-pager or the full PRD.',
      when: 'writing a **PRD** with goals, metrics and traceable requirements',
    },
    'writing-user-stories': {
      keys: ['user stor', 'stories', 'acceptance criteria', 'gherkin', 'jira', 'linear', 'invest', 'sprint', 'definition of ready'],
      paste: '- The **requirements** or the PRD section\n- Your backlog **tool** (Jira, Linear…)\n- Any **business rules** and edge cases you know',
      tips: '- Set your tool in your profile once: every story comes in that format.\n- Paste a PRD with requirement IDs to keep traceability.',
      when: 'turning requirements into **sprint-ready stories** with acceptance criteria',
    },
    'testing-apis': {
      keys: ['api', 'endpoint', 'openapi', 'swagger', 'rest', 'curl', 'postman', 'test plan'],
      paste: '- The **endpoint(s)**, an example **request and response**\n- The **business rules** the API must respect',
      tips: '- Business rules give the best test cases (limits, statuses, permissions).',
      when: 'building an **API test plan** and documentation',
    },
    'generating-sql': {
      keys: ['sql', 'query', 'database', 'table', 'kpi', 'report', 'how many', 'count'],
      paste: '- The **question** in plain words\n- The **database** type and the **tables / columns** if you have them',
      tips: '- Say the period and the grain ("per month, per client") to avoid ambiguity.',
      when: 'getting a **SQL query** explained in plain language',
    },
  };

  // ---------- glossary ----------
  const TERMS = [
    [['rag', 'retrieval augmented'], 'RAG (retrieval-augmented generation)', 'The assistant first **retrieves** passages from approved content (help centre, tariffs…), then **writes** its answer from them. Good RAG answers only from what it retrieved, and cites it.'],
    [['faithful', 'hallucinat', 'groundedness'], 'Faithfulness', 'Is every claim in the answer **supported by the retrieved passages**? A hallucination is an unfaithful answer. In banking the release gate is usually **100% on high-risk questions**.'],
    [['context recall', 'recall'], 'Context recall', 'Did retrieval **find the passages needed** to answer? Low recall means a retrieval or content problem, not a model problem.'],
    [['context precision', 'precision'], 'Context precision', 'Of the passages retrieved, **how many were relevant**? Low precision means noise (outdated or off-topic pages) reaches the model.'],
    [['answer relevance', 'relevance'], 'Answer relevance', 'Does the answer **address the question asked**, without padding or drifting to another topic?'],
    [['golden set', 'golden dataset', 'test set'], 'Golden set', 'The reference list of test questions, each with the **expected answer and source**. Mix answerable, escalation, unanswerable and adversarial questions, and include real customer wording.'],
    [['judge', 'llm as judge'], 'LLM-as-judge', 'A model scores the answers against the expected ones. Calibrate it: have people re-check a sample (e.g. 25%) and track **judge–human agreement** (target ≥ 90%).'],
    [['containment', 'deflection', 'automation rate'], 'Containment with resolution', 'Conversations closed **without an advisor and without a repeat contact** within 72h. Plain containment rewards bots that trap customers; this version doesn\'t.'],
    [['prompt injection', 'injection', 'jailbreak'], 'Prompt injection (OWASP LLM01)', 'Text that tries to **override the assistant\'s instructions**: typed by a user ("ignore your rules…") or hidden in a document or email it reads. Controls: treat user and retrieved text as data, filter every turn, red-team it.'],
    [['owasp'], 'OWASP Top 10 for LLM Applications', 'The reference list of LLM security risks: prompt injection, sensitive information disclosure, supply chain, data poisoning, improper output handling, excessive agency, system prompt leakage, vector & embedding weaknesses, misinformation, unbounded consumption.'],
    [['excessive agency', 'agency'], 'Excessive agency (OWASP LLM06)', 'The assistant can **do more than it should** (move money, change limits) or acts without confirmation. Control: least privilege, and an in-app confirmation before any action.'],
    [['ai act', 'article 50', 'art 50', 'transparency'], 'EU AI Act, Art. 50', 'Transparency duty: people must be told they are **interacting with an AI** unless it\'s obvious. Applies from 2 August 2026. Confirm the wording and placement with Legal.'],
    [['gdpr', 'rgpd', 'dpia', 'aipd'], 'GDPR & DPIA', 'Personal data in prompts, logs and retrieval must have a legal basis, minimisation and retention rules. A **DPIA** is likely for a new AI system processing customer data at scale. Owner: the DPO.'],
    [['dora'], 'DORA', 'EU Digital Operational Resilience Act for financial entities: ICT risk management, incident reporting, and a **register of ICT third-party providers** (your LLM provider goes in it).'],
    [['red team', 'red teaming', 'adversarial'], 'Red teaming', 'Trying to **break the assistant on purpose**: injections, data leaks, forbidden advice, unwanted actions. Each attack becomes a test case in the golden set.'],
    [['guardrail'], 'Guardrail', 'A **testable rule** that limits what the assistant can say or do, e.g. "answer only from approved, in-date sources, with a citation". Each guardrail links to a risk and a test.'],
    [['hand off', 'handoff', 'escalation', 'escalat'], 'Hand-off', 'Passing the conversation to a person **with its context**, so the customer doesn\'t repeat themselves. Always available on request, automatic on fraud, failure or frustration.'],
    [['fallback'], 'Fallback', 'What the assistant does when it doesn\'t understand or has no source. Good fallbacks rephrase once, offer options, then hand off. Never a dead end.'],
    [['utterance'], 'Utterance', 'A real way a customer phrases a need: "cant get in my acount", "carte bloquée". Collect many per intent, typos included.'],
    [['intent'], 'Intent', 'What the customer wants to achieve ("unlock my access"). One journey usually covers one intent.'],
    [['gherkin', 'given when then'], 'Gherkin', 'Acceptance criteria written as **Given / When / Then** scenarios, readable by business and testable by QA.'],
    [['raci'], 'RACI', '**R**esponsible (does it), **A**ccountable (decides, one per row), **C**onsulted, **I**nformed.'],
    [['bpmn'], 'BPMN 2.0', 'The standard notation for process diagrams. Lanes show who does what; the `.bpmn` file opens in Camunda, bpmn.io or Signavio.'],
    [['invest'], 'INVEST', 'A good story is Independent, Negotiable, Valuable, Estimable, Small, Testable.'],
    [['moscow'], 'MoSCoW', 'Must, Should, Could, Won\'t (this time). A simple way to prioritise requirements.'],
    [['csat'], 'CSAT', 'Customer satisfaction score from a short survey after the conversation, usually on a 1 to 5 scale.'],
    [['chunk', 'embedding', 'vector'], 'Chunks & embeddings', 'Content is split into **chunks** that are retrieved alone, so each section must make sense on its own. Embeddings are how the system finds chunks similar to the question.'],
  ];

  // ---------- how the app works ----------
  const APP = [
    [['how does', 'how it works', 'how do i start', 'get started', 'what is this', 'what can you do', 'help', 'start'], 'How Analyst Kit works',
      '1. **Pick a deliverable** in the sidebar or press **N**.\n2. **Paste your notes** (or drop a .txt, .md or .csv file), or click a **scenario** to try one.\n3. **Create**: Claude writes the document and you get a notification.\n4. **Ask for changes** in the conversation next to it. Every version is kept.\n5. **Hand it over**: Word, PDF or copy, then *Mark as sent*.',
      [{ label: 'New deliverable', href: '#/new' }]],
    [['change', 'edit', 'modify', 'feedback', 'comment', 'reply', 'shorter', 'translate', 'french'], 'Asking for changes',
      'Open the deliverable and write in the **Conversation** panel on the right, e.g. *"make it shorter for the steerco"* or *"translate to French"*. Claude updates the document and keeps the old version (see *Versions* at the top).'],
    [['word', 'pdf', 'export', 'download', 'copy', 'docx', 'email', 'confluence', 'send to client'], 'Exporting',
      'On any finished deliverable: **Download Word** (diagrams included), **Save as PDF**, or **Copy** to paste formatted into an email, Notion or Confluence. Then click **Mark as sent** to track what each client received.'],
    [['version', 'history', 'previous', 'undo'], 'Versions',
      'Every time Claude updates a document, the previous version is kept. Use the version bar at the top of the deliverable to look at or export an older one.'],
    [['offline', 'online', 'not answering', 'waiting', 'nothing happens', 'stuck', 'slow'], 'When Claude is offline',
      'The dot at the bottom of the sidebar shows if Claude is picking up requests. If it says **offline**, go to your Claude Code chat and type **"check my requests"**. Your requests wait safely until then. *I* (the guide) always answer instantly.'],
    [['profile', 'my name', 'prepared by', 'tone', 'language', 'logo'], 'Your profile',
      'In **Profile** set your name, title and company (printed as *Prepared by* on every document), your language, tone and backlog tool. Claude also remembers preferences you give in the chat.',
      [{ label: 'Open profile', href: '#/profile' }]],
    [['next step', 'what next', 'continue', 'after this', 'chain'], 'Continuing from a document',
      'Under each finished deliverable, **Continue from this document** offers the logical next one, e.g. roadmap → conversation design → evaluation plan. It starts the new request with the current document as notes.'],
    [['shortcut', 'keyboard', 'hotkey'], 'Shortcuts', '**N** new deliverable · **/** search · **⌘↵** send or create · **?** open this guide · **Esc** close full screen.'],
    [['diagram', 'zoom', 'full screen', 'fullscreen', 'camunda', 'signavio', 'bpmn file'], 'Diagrams',
      'Process diagrams are real BPMN 2.0: drag to move, use the zoom buttons or **Full screen**, and download **.bpmn**, PNG or SVG. The `.bpmn` file opens in Camunda Modeler, bpmn.io or Signavio.'],
    [['delete', 'remove'], 'Deleting', 'Open the deliverable and use the delete action at the bottom of the document. Deleted samples don\'t come back.'],
    [['which', 'what deliverable', 'which skill', 'recommend', 'i need', 'i want', 'should i use'], null, null],
  ];

  // ---------- state ----------
  const G = { open: false, msgs: [], busy: false };
  try { G.open = sessionStorage.getItem('guide-open') === '1'; } catch {}

  function context() {
    const r = location.hash.replace(/^#/, '') || '/';
    let m, type = null, page = 'home', req = null;
    if ((m = r.match(/^\/new(?:\/([a-z-]+))?/))) { page = 'new'; type = m[1] || null; if (!type) { const on = $('#seg .on'); type = on && on.dataset.t; } }
    else if ((m = r.match(/^\/type\/([a-z-]+)/))) { page = 'type'; type = m[1]; }
    else if ((m = r.match(/^\/d\/(\d+)/))) { page = 'doc'; req = K().state.requests.find((x) => x.id === +m[1]); type = req && req.type; }
    else if (r.startsWith('/chat')) page = 'chat';
    else if (r.startsWith('/profile')) page = 'profile';
    return { page, type, req };
  }
  const tName = (id) => K().typeOf(id).name;
  const sampleOf = (id) => K().state.requests.find((r) => r.is_sample && r.type === id);

  function suggestions() {
    const c = context();
    if (c.page === 'new' && c.type) return [`What should I paste for ${tName(c.type)}?`, 'Fill a scenario for me', `Tips for a great ${tName(c.type)}`, 'Explain a term'];
    if (c.page === 'type' && c.type) return [`When do I use ${tName(c.type)}?`, `Show me a finished ${tName(c.type)}`, `What should I paste for ${tName(c.type)}?`];
    if (c.page === 'doc') return ['How do I ask for changes?', 'Export to Word or PDF', 'What comes next after this?', 'Explain a term'];
    return ['How does this work?', 'Which deliverable do I need?', 'Is my bot good enough to go live?', 'What is faithfulness?'];
  }

  // ---------- answering ----------
  const hits = (t, keys) => keys.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
  function skillIn(t) {
    let best = null, score = 0;
    for (const ty of K().state.types) {
      const name = norm(ty.name);
      const s = (t.includes(name) ? 50 : 0) + hits(t, SKILLS[ty.id] ? SKILLS[ty.id].keys : []);
      if (s > score) { best = ty.id; score = s; }
    }
    return score ? { id: best, score } : null;
  }

  function skillCard(id, lead) {
    const t = K().typeOf(id), h = SKILLS[id] || {};
    const acts = [{ label: `Start ${t.name}`, href: '#/new/' + id }];
    const s = sampleOf(id);
    if (s) acts.push({ label: 'Open the finished sample', href: '#/d/' + s.id });
    const what = h.when || t.gets.toLowerCase();
    return { a: `${lead ? `${lead}**${t.name}**. It's for ${what}.` : `**${t.name}** is for ${what}.`}\n\n**You give:** ${t.gives.toLowerCase()}.\n**You get:** ${t.gets.toLowerCase()}.`, acts };
  }

  function answer(raw) {
    const t = ' ' + norm(raw) + ' ';
    const c = context();
    const sk = skillIn(t);
    const target = (sk && sk.score >= 3 ? sk.id : null) || c.type;

    const pick = { a: 'Tell me what you need in a few words, for example *"decide which use cases first"*, *"check if the bot is good enough"* or *"prepare the steerco"*. Or pick one:', acts: K().state.types.slice(5).concat(K().state.types.slice(0, 5)).map((ty) => ({ label: ty.name, href: '#/type/' + ty.id })) };
    if (/\b(which (deliverable|skill|one)|what should i use|recommend)\b/.test(t) && !(sk && sk.score >= 3)) return pick;

    // intents about a skill
    if (/\b(fill|scenario|try one|demo)\b/.test(t) && c.page === 'new' && c.type) {
      const ex = K().typeOf(c.type).examples || [];
      return { a: `Pick a scenario. I'll fill the form, you just press **Create deliverable**.`, acts: ex.filter((e) => e.notes).map((e, i) => ({ label: e.label, fill: i })) };
    }
    if (/\b(sample|examples?|finished|show me|demo|see one|try)\b/.test(t) && target) {
      const s = sampleOf(target), ex = (K().typeOf(target).examples || []).filter((e) => e.notes);
      const acts = [];
      if (s) acts.push({ label: 'Open the finished sample', href: '#/d/' + s.id });
      ex.forEach((e, i) => acts.push({ label: 'Try: ' + e.label, example: [target, i] }));
      return { a: s ? `Here is a finished **${tName(target)}**: *${K().esc(s.title)}*. Or start one from a realistic scenario:` : `Start a **${tName(target)}** from a realistic scenario:`, acts };
    }
    if (/\b(paste|give|input|what do i (put|write|need)|notes|provide)\b/.test(t) && target && SKILLS[target]) {
      return { a: `For **${tName(target)}**, paste:\n\n${SKILLS[target].paste}\n\nRough notes are fine. Claude asks in the conversation if something is missing.`, acts: [{ label: `Start ${tName(target)}`, href: '#/new/' + target }] };
    }
    if (/\b(tips?|better|great|good result|best|improve)\b/.test(t) && target && SKILLS[target]) {
      return { a: `**Tips for ${tName(target)}:**\n\n${SKILLS[target].tips}` };
    }
    if (/\b(what will i get|output|what do i get|deliverable|results?|when do i use|what is it for)\b/.test(t) && target) {
      return skillCard(target);
    }
    if (/\b(next|after this|continue|then what)\b/.test(t) && c.page === 'doc' && c.type) {
      const nx = (K().typeOf(c.type).next || []).map(K().typeOf);
      if (nx.length) return { a: `After **${tName(c.type)}**, the usual next step is ${nx.map((n) => `**${n.name}**`).join(' or ')}. Use *Continue from this document* below the document: it starts the next one with this document as notes.` };
    }

    // glossary
    let term = null, ts = 0;
    for (const [keys, name, def] of TERMS) { const s = hits(t, keys.map((k) => ' ' + k)); if (s > ts) { ts = s; term = [name, def]; } }
    const asksDef = /what is|what s|whats|what are|define|meaning|mean|explain|c est quoi|difference/.test(t);
    if (term && (asksDef || t.trim().split(' ').length <= 3)) return { a: `**${term[0]}**\n\n${term[1]}` };
    if (/explain a term|glossary|jargon/.test(t)) return { a: 'Ask me any term, for example:', acts: ['faithfulness', 'context recall', 'golden set', 'prompt injection', 'containment', 'AI Act Art. 50', 'RACI'].map((x) => ({ label: x, say: 'What is ' + x + '?' })) };

    // app how-to
    let app = null, as = 0;
    for (const e of APP) { const s = hits(t, e[0]); if (s > as) { as = s; app = e; } }
    if (app && app[1] && as >= 4 && !(sk && sk.score > as)) return { a: `**${app[1]}**\n\n${app[2]}`, acts: app[3] };

    // recommend a skill from a described need
    if (sk) return skillCard(sk.id, 'Sounds like a job for ');
    if (term) return { a: `**${term[0]}**\n\n${term[1]}` };
    if (app && app[1]) return { a: `**${app[1]}**\n\n${app[2]}`, acts: app[3] };
    if (/\b(which|i need|should i)\b/.test(t)) return pick;
    return null;
  }

  // ---------- UI ----------
  const md = (s) => (window.DOMPurify ? DOMPurify.sanitize(marked.parse(s)) : s);
  function paint() {
    const root = $('#guide');
    root.hidden = !G.open;
    $('#guide-btn').classList.toggle('on', G.open);
    if (!G.open) return;
    const feed = $('#guide-feed');
    const intro = { role: 'bot', a: `Hi${K().state.profile.name ? ' ' + K().esc(K().state.profile.name.split(' ')[0]) : ''}! I'm the guide. I answer instantly about the deliverables, the jargon and the app. For real work, Claude takes over in the chat.` };
    feed.innerHTML = [intro, ...G.msgs].map((m, i) => m.role === 'user'
      ? `<div class="g-msg user">${K().esc(m.text)}</div>`
      : `<div class="g-msg bot"><div class="md">${md(m.a)}</div>${(m.acts || []).length ? `<div class="g-acts">${m.acts.map((x, j) => `<button class="chip" data-act="${i}:${j}">${K().esc(x.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
    $('#guide-sugg').innerHTML = suggestions().map((q) => `<button class="chip" data-q="${K().esc(q)}">${K().esc(q)}</button>`).join('');
    feed.scrollTop = feed.scrollHeight;
  }
  function say(text) {
    text = text.trim();
    if (!text) return;
    G.msgs.push({ role: 'user', text });
    const r = answer(text);
    G.msgs.push(r ? { role: 'bot', ...r } : {
      role: 'bot', a: "I don't have a quick answer for that one. Claude can answer it properly in your chat.",
      acts: [{ label: 'Ask Claude', ask: text }],
    });
    G.msgs = G.msgs.slice(-30);
    paint();
  }
  async function act(x) {
    if (x.href) location.hash = x.href;
    else if (x.fill !== undefined) { if (!K().fill(x.fill)) K().startExample(context().type, x.fill); K().toast('Scenario filled in. Press Create deliverable'); }
    else if (x.example) K().startExample(x.example[0], x.example[1]);
    else if (x.say) return say(x.say);
    else if (x.ask) { await K().ask(x.ask); location.hash = '#/chat'; G.msgs.push({ role: 'bot', a: 'Sent to Claude. The answer will appear in **Chat with Claude**.' }); }
    paint();
  }
  function toggle(on = !G.open) {
    G.open = on;
    try { sessionStorage.setItem('guide-open', on ? '1' : '0'); } catch {}
    paint();
    if (on) setTimeout(() => $('#guide-input').focus(), 0);
  }

  function mount() {
    document.body.insertAdjacentHTML('beforeend', `
      <button class="guide-btn" id="guide-btn" aria-label="Open the guide" title="Guide · instant help (?)"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.4" r=".8" fill="currentColor"/></svg><span>Guide</span></button>
      <section class="guide" id="guide" role="dialog" aria-label="Guide" hidden>
        <header><b>Guide</b><span>Instant answers · no API key</span><button class="icon-btn" id="guide-close" aria-label="Close guide"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></header>
        <div class="g-feed" id="guide-feed"></div>
        <div class="g-sugg chips" id="guide-sugg"></div>
        <form class="g-form" id="guide-form" autocomplete="off"><input id="guide-input" placeholder="Ask about a deliverable, a term, the app…"><button class="btn primary" type="submit">Ask</button></form>
      </section>`);
    $('#guide-btn').onclick = () => toggle();
    $('#guide-close').onclick = () => toggle(false);
    $('#guide-form').onsubmit = (e) => { e.preventDefault(); const i = $('#guide-input'); say(i.value); i.value = ''; };
    $('#guide').addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]'); if (q) return say(q.dataset.q);
      const a = e.target.closest('[data-act]');
      if (a) { const [i, j] = a.dataset.act.split(':').map(Number); const all = [null, ...G.msgs]; act(all[i].acts[j]); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && G.open) toggle(false);
      if (e.key !== '?' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      e.preventDefault(); toggle();
    });
    addEventListener('hashchange', () => setTimeout(paint, 50));
    const wait = setInterval(() => { if (K() && K().state.loaded) { clearInterval(wait); paint(); } }, 100);
  }
  mount();
})();

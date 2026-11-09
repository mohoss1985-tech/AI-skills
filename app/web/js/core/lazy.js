/* Lazy loaders for the vendored libraries (app/web/vendor/, pinned versions, no CDN).
   Each returns a promise of the library global and loads its script/css once.
     loadMarked()      → marked 15.x          loadPurify()  → DOMPurify 3.x
     loadMermaid()     → mermaid 11.17.2      loadHljs()    → highlight.js 11.11.1 (core + json/xml/sql/bash/js/python/yaml/gherkin)
     loadBpmnViewer()  → bpmn-js 18.31.1 NavigatedViewer (BpmnJS)
     loadBpmnModeler() → bpmn-js 18.31.1 Modeler (window.BpmnJSModeler)  + diagram-js/bpmn-js css
     loadSqlJs()       → sql.js 1.14.2 initSqlJs({locateFile}) already called → SQL namespace */
const scripts = new Map();
export function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => ok(); s.onerror = () => { scripts.delete(src); bad(new Error('Could not load ' + src)); };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}
const styles = new Set();
export function loadCss(href) {
  if (styles.has(href)) return;
  styles.add(href);
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href;
  document.head.append(l);
}

const V = 'vendor/';
export const loadMarked = () => loadScript(V + 'marked/marked.umd.js').then(() => window.marked);
export const loadPurify = () => loadScript(V + 'dompurify/purify.min.js').then(() => window.DOMPurify);
export const loadMermaid = () => loadScript(V + 'mermaid/mermaid.min.js').then(() => window.mermaid);
export const loadHljs = () => loadScript(V + 'highlight/highlight.min.js').then(() => window.hljs);
function bpmnCss() {
  loadCss(V + 'bpmn-js/assets/diagram-js.css');
  loadCss(V + 'bpmn-js/assets/bpmn-js.css');
  loadCss(V + 'bpmn-js/assets/bpmn-font/css/bpmn.css');
}
export const loadBpmnViewer = () => { bpmnCss(); return loadScript(V + 'bpmn-js/bpmn-navigated-viewer.production.min.js').then(() => window.BpmnJS); };
let modeler;
export function loadBpmnModeler() {
  bpmnCss();
  if (!modeler) {
    modeler = (async () => {
      const viewer = window.BpmnJS; // the viewer and the modeler both define window.BpmnJS: keep both
      await loadScript(V + 'bpmn-js/bpmn-modeler.production.min.js');
      window.BpmnJSModeler = window.BpmnJS;
      if (viewer) window.BpmnJS = viewer;
      return window.BpmnJSModeler;
    })();
  }
  return modeler;
}
let sql;
export function loadSqlJs() {
  if (!sql) sql = loadScript(V + 'sql.js/sql-wasm.js').then(() => window.initSqlJs({ locateFile: (f) => V + 'sql.js/' + f }));
  return sql;
}

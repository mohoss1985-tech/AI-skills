// Draft: BPMN editor with bpmn-js 18.31.1 Modeler (UMD build, global "BpmnJS"), lazy-loaded on the Process map tool.
// Files (jsDelivr): dist/bpmn-modeler.production.min.js 572 KB (162 KB gz)
//                   dist/assets/diagram-js.css, bpmn-js.css, bpmn-font/css/bpmn.css (~15 KB total)
// Licence: MIT-style + bpmn.io watermark clause - the bpmn.io logo drawn in the canvas corner MUST stay
// visible and not covered. So: no toolbar/overlay in the bottom-right corner of the canvas; keep it in print/PNG
// only where the library draws it (saveSVG output does not contain it, which is fine: it is the on-screen watermark).
const BPMN = 'https://cdn.jsdelivr.net/npm/bpmn-js@18.31.1/dist/';

function loadOnce(tag, attrs) {
  const key = attrs.src || attrs.href;
  if (document.querySelector(`[src="${key}"],[href="${key}"]`)) return Promise.resolve();
  return new Promise((ok, bad) => { const el = Object.assign(document.createElement(tag), attrs, { onload: ok, onerror: bad }); document.head.appendChild(el); });
}
async function loadModeler() {
  await Promise.all(['assets/diagram-js.css', 'assets/bpmn-js.css', 'assets/bpmn-font/css/bpmn.css']
    .map((f) => loadOnce('link', { rel: 'stylesheet', href: BPMN + f })));
  await loadOnce('script', { src: BPMN + 'bpmn-modeler.production.min.js' });
  return window.BpmnJS; // the modeler bundle exposes BpmnJS (the V1 viewer bundle exposes the same global name)
}

async function mountEditor(container, xml) {
  const BpmnJS = await loadModeler();
  const modeler = new BpmnJS({ container, keyboard: { bindTo: document } });
  const { warnings } = await modeler.importXML(xml); // throws on invalid XML -> show "This file isn't valid BPMN 2.0"
  modeler.get('canvas').zoom('fit-viewport');
  modeler.on('commandStack.changed', () => container.dispatchEvent(new CustomEvent('bpmn-dirty')));
  return { modeler, warnings };
}

// Import a .bpmn picked by the user
async function importFile(modeler, file) { await modeler.importXML(await file.text()); modeler.get('canvas').zoom('fit-viewport'); }
// Export
async function exportBpmn(modeler) { const { xml } = await modeler.saveXML({ format: true }); return xml; }      // .bpmn (Camunda/Signavio/Bizagi import)
async function exportSvg(modeler) { const { svg } = await modeler.saveSVG(); return svg; }                     // -> PNG via the V1 svgTextToPng()

// Empty diagram to start from
const NEW_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Defs_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="Start_1"/></bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
    <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="180" y="160" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

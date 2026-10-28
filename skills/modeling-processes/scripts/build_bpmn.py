"""Build a laid-out, colour-coded BPMN 2.0 file from a small JSON spec.

    python3 build_bpmn.py spec.json > process.bpmn

Spec:
{
  "pool": "Brightwave Finance · Accounts payable",          # optional participant name
  "lanes": [{"id": "ap", "name": "AP clerk"}, ...],          # top to bottom
  "nodes": [{"id": "s", "type": "start", "name": "Invoice received", "lane": "ap", "trigger": "message"}, ...],
  "flows": [{"from": "s", "to": "a", "label": "Yes"}, ...]
}
Node types: start, end, task, user, service, send, receive, manual, subprocess,
exclusive, parallel, inclusive, event_gateway, timer, message, error_end.
start/end accept "trigger": message | timer | error | none.

The output opens in Camunda Modeler, bpmn.io, Signavio and other BPMN 2.0 tools.
Colours follow one meaning per colour (events green/red, work blue, decisions
amber, waits purple) and are written both as bpmn.io (bioc) and OMG (color) attributes.
"""

import json
import sys
from collections import defaultdict, deque
from xml.sax.saxutils import escape

COL_W, ROW_H = 190, 130          # grid cell size
POOL_HEAD, LANE_HEAD = 34, 34     # vertical title bands on the left
X0, Y0 = 40, 40

SIZE = {"event": (36, 36), "gateway": (50, 50), "activity": (130, 80)}
KIND = {
    "start": "event", "end": "event", "error_end": "event", "timer": "event", "message": "event",
    "exclusive": "gateway", "parallel": "gateway", "inclusive": "gateway", "event_gateway": "gateway",
}
TAG = {
    "start": "startEvent", "end": "endEvent", "error_end": "endEvent",
    "timer": "intermediateCatchEvent", "message": "intermediateCatchEvent",
    "task": "task", "user": "userTask", "service": "serviceTask", "send": "sendTask",
    "receive": "receiveTask", "manual": "manualTask", "subprocess": "subProcess",
    "exclusive": "exclusiveGateway", "parallel": "parallelGateway",
    "inclusive": "inclusiveGateway", "event_gateway": "eventBasedGateway",
}
# (fill, stroke): one meaning per colour, readable in greyscale through shape alone
PALETTE = {
    "start": ("#e7f6ec", "#1f7a45"), "end": ("#fdecec", "#b42318"), "error_end": ("#fdecec", "#b42318"),
    "timer": ("#f1ebfb", "#6941c6"), "message": ("#f1ebfb", "#6941c6"),
    "gateway": ("#fff6e0", "#b54708"), "activity": ("#e8f0fe", "#1d4ed8"),
    "subprocess": ("#eef2f6", "#344054"),
}
LANE_TINTS = ["#f8fafc", "#fcfcfd"]


def kind(t):
    return KIND.get(t, "activity")


def colour(t):
    return PALETTE.get(t) or PALETTE.get(kind(t)) or PALETTE["activity"]


def layer(nodes, flows):
    """Column per node: longest path from the starts, ignoring loop-back edges."""
    out = defaultdict(list)
    for f in flows:
        out[f["from"]].append(f["to"])
    order = [n["id"] for n in nodes]
    starts = [n["id"] for n in nodes if n["type"] == "start"] or order[:1]
    # DFS to find back edges so loops don't break the layering
    back, state = set(), {}

    def dfs(u):
        state[u] = 1
        for v in out[u]:
            if state.get(v) == 1:
                back.add((u, v))
            elif v not in state:
                dfs(v)
        state[u] = 2

    for s in starts + order:
        if s not in state:
            dfs(s)
    indeg = defaultdict(int)
    for u in order:
        for v in out[u]:
            if (u, v) not in back:
                indeg[v] += 1
    col = {u: 0 for u in order}
    q = deque(u for u in order if indeg[u] == 0)
    while q:
        u = q.popleft()
        for v in out[u]:
            if (u, v) in back:
                continue
            col[v] = max(col[v], col[u] + 1)
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return col, back


def build(spec):
    lanes, nodes, flows = spec["lanes"], spec["nodes"], spec["flows"]
    by_id = {n["id"]: n for n in nodes}
    col, back = layer(nodes, flows)

    # rows inside each lane: nodes sharing a column in the same lane stack vertically
    slot = {}
    used = defaultdict(int)
    for n in sorted(nodes, key=lambda n: (col[n["id"]], [l["id"] for l in lanes].index(n["lane"]))):
        key = (n["lane"], col[n["id"]])
        slot[n["id"]] = used[key]
        used[key] += 1
    rows = {l["id"]: max([used[(l["id"], c)] for c in set(col.values())] + [1]) for l in lanes}

    left = X0 + POOL_HEAD + LANE_HEAD
    ncols = max(col.values()) + 1
    width = POOL_HEAD + LANE_HEAD + ncols * COL_W + 40
    lane_y, y = {}, Y0
    for l in lanes:
        lane_y[l["id"]] = (y, rows[l["id"]] * ROW_H)
        y += rows[l["id"]] * ROW_H
    height = y - Y0

    box = {}
    for n in nodes:
        w, h = SIZE[kind(n["type"])]
        ly, _ = lane_y[n["lane"]]
        cx = left + col[n["id"]] * COL_W + COL_W / 2
        cy = ly + slot[n["id"]] * ROW_H + ROW_H / 2
        box[n["id"]] = (cx - w / 2, cy - h / 2, w, h)

    def mid(i):
        x, y, w, h = box[i]
        return x + w / 2, y + h / 2

    exits = defaultdict(set)

    def edge_points(f):
        sx, sy, sw, sh = box[f["from"]]
        tx, ty, tw, th = box[f["to"]]
        (scx, scy), (tcx, tcy) = mid(f["from"]), mid(f["to"])
        if (f["from"], f["to"]) in back or tcx <= scx:      # loop back: go under both shapes
            ly, lh = lane_y[by_id[f["from"]]["lane"]]
            yb = max(sy + sh, ty + th) + 18
            return [(scx, sy + sh), (scx, yb), (tcx, yb), (tcx, ty + th)]
        if abs(scy - tcy) < 1:
            return [(sx + sw, scy), (tx, tcy)]
        side = "top" if tcy < scy else "bottom"
        if kind(by_id[f["from"]]["type"]) == "gateway" and side not in exits[f["from"]]:
            exits[f["from"]].add(side)                       # leave a gateway from top/bottom once per side
            return [(scx, sy if side == "top" else sy + sh), (scx, tcy), (tx, tcy)]
        midx = tx - 30
        return [(sx + sw, scy), (midx, scy), (midx, tcy), (tx, tcy)]

    # ----- XML -----
    def attrs(t):
        fill, stroke = colour(t)
        return (f' bioc:stroke="{stroke}" bioc:fill="{fill}"'
                f' color:background-color="{fill}" color:border-color="{stroke}"')

    lane_refs = defaultdict(list)
    for n in nodes:
        lane_refs[n["lane"]].append(n["id"])
    incoming, outgoing = defaultdict(list), defaultdict(list)
    for i, f in enumerate(flows):
        f["id"] = f.get("id") or f"Flow_{i + 1}"
        outgoing[f["from"]].append(f["id"])
        incoming[f["to"]].append(f["id"])

    sem = []
    for n in nodes:
        t, tag = n["type"], TAG.get(n["type"], "task")
        inner = "".join(f"<bpmn:incoming>{x}</bpmn:incoming>" for x in incoming[n["id"]])
        inner += "".join(f"<bpmn:outgoing>{x}</bpmn:outgoing>" for x in outgoing[n["id"]])
        trig = n.get("trigger") or {"timer": "timer", "message": "message", "error_end": "error"}.get(t)
        if trig == "timer":
            inner += "<bpmn:timerEventDefinition/>"
        elif trig == "message":
            inner += "<bpmn:messageEventDefinition/>"
        elif trig == "error":
            inner += "<bpmn:errorEventDefinition/>"
        sem.append(f'    <bpmn:{tag} id="{n["id"]}" name="{escape(n.get("name", ""), {chr(34): "&quot;"})}">{inner}</bpmn:{tag}>')
    for f in flows:
        name = f' name="{escape(f["label"], {chr(34): "&quot;"})}"' if f.get("label") else ""
        sem.append(f'    <bpmn:sequenceFlow id="{f["id"]}" sourceRef="{f["from"]}" targetRef="{f["to"]}"{name}/>')
    lane_xml = "\n".join(
        f'      <bpmn:lane id="Lane_{l["id"]}" name="{escape(l["name"])}">'
        + "".join(f"<bpmn:flowNodeRef>{r}</bpmn:flowNodeRef>" for r in lane_refs[l["id"]])
        + "</bpmn:lane>" for l in lanes)

    di = [f'      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true" '
          f'bioc:stroke="#344054" bioc:fill="#ffffff" color:border-color="#344054" color:background-color="#ffffff">'
          f'<dc:Bounds x="{X0}" y="{Y0}" width="{width}" height="{height}"/></bpmndi:BPMNShape>']
    for i, l in enumerate(lanes):
        ly, lh = lane_y[l["id"]]
        tint = LANE_TINTS[i % 2]
        di.append(f'      <bpmndi:BPMNShape id="Lane_{l["id"]}_di" bpmnElement="Lane_{l["id"]}" isHorizontal="true" '
                  f'bioc:stroke="#475467" bioc:fill="{tint}" color:border-color="#475467" color:background-color="{tint}">'
                  f'<dc:Bounds x="{X0 + POOL_HEAD}" y="{ly}" width="{width - POOL_HEAD}" height="{lh}"/></bpmndi:BPMNShape>')
    for n in nodes:
        x, y, w, h = box[n["id"]]
        label = ""
        if kind(n["type"]) != "activity":
            lw = 110
            label = f'<bpmndi:BPMNLabel><dc:Bounds x="{x + w / 2 - lw / 2:.0f}" y="{y + h + 6:.0f}" width="{lw}" height="27"/></bpmndi:BPMNLabel>'
        expanded = ' isExpanded="false"' if n["type"] == "subprocess" else ""
        di.append(f'      <bpmndi:BPMNShape id="{n["id"]}_di" bpmnElement="{n["id"]}"{expanded}{attrs(n["type"])}>'
                  f'<dc:Bounds x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}"/>{label}</bpmndi:BPMNShape>')
    for f in flows:
        pts = edge_points(f)
        wps = "".join(f'<di:waypoint x="{px:.0f}" y="{py:.0f}"/>' for px, py in pts)
        label = ""
        if f.get("label"):
            (ax, ay), (bx, by) = pts[0], pts[1]
            lx, lyy = (ax + 6, (ay + by) / 2 - 7) if abs(ax - bx) < 1 else ((ax + bx) / 2 - 15, ay - 20)
            label = f'<bpmndi:BPMNLabel><dc:Bounds x="{lx:.0f}" y="{lyy:.0f}" width="40" height="14"/></bpmndi:BPMNLabel>'
        di.append(f'      <bpmndi:BPMNEdge id="{f["id"]}_di" bpmnElement="{f["id"]}" '
                  f'bioc:stroke="#475467" color:border-color="#475467">{wps}{label}</bpmndi:BPMNEdge>')

    pool = escape(spec.get("pool") or "Process")
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
  xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Analyst Kit" exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="{pool}" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
{lane_xml}
    </bpmn:laneSet>
{chr(10).join(sem)}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
{chr(10).join(di)}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
'''


def validate(spec):
    lane_ids = {l["id"] for l in spec["lanes"]}
    ids = {n["id"] for n in spec["nodes"]}
    errs = [f'node {n["id"]}: unknown lane {n["lane"]}' for n in spec["nodes"] if n["lane"] not in lane_ids]
    errs += [f'flow {f["from"]}->{f["to"]}: unknown node' for f in spec["flows"] if f["from"] not in ids or f["to"] not in ids]
    errs += [f'node {n["id"]}: unknown type {n["type"]}' for n in spec["nodes"] if n["type"] not in TAG]
    return errs


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin)
    problems = validate(spec)
    if problems:
        sys.exit("Spec errors:\n  " + "\n  ".join(problems))
    sys.stdout.write(build(spec))

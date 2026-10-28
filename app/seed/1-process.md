{"client": "Brightwave Finance (sample)", "skill": "modeling-processes", "title": "Accounts payable invoice approval", "input_tokens": 2140, "output_tokens": 1180, "seconds": 38}
===INPUT===
Model this as BPMN.

Supplier invoices arrive in the AP inbox. The AP clerk matches each invoice to its purchase order. If it doesn't match, it goes back to the supplier with a note. Matched invoices above €5,000 need sign-off from the finance manager. Approved invoices are scheduled by treasury in the next weekly payment run.
===OUTPUT===
**Diagram:** BPMN 2.0 collaboration with three lanes. The process hands work between three roles in a fixed order, so lanes make each hand-off visible. Open it full screen, or download the `.bpmn` file to edit it in Camunda Modeler, bpmn.io or Signavio.

### Process model

```bpmn
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
  xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Analyst Kit" exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Brightwave Finance · Accounts payable" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_ap" name="AP clerk"><bpmn:flowNodeRef>s</bpmn:flowNodeRef><bpmn:flowNodeRef>a</bpmn:flowNodeRef><bpmn:flowNodeRef>b</bpmn:flowNodeRef><bpmn:flowNodeRef>r</bpmn:flowNodeRef><bpmn:flowNodeRef>xr</bpmn:flowNodeRef><bpmn:flowNodeRef>c</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_fm" name="Finance manager"><bpmn:flowNodeRef>d</bpmn:flowNodeRef><bpmn:flowNodeRef>g</bpmn:flowNodeRef><bpmn:flowNodeRef>z</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_tr" name="Treasury"><bpmn:flowNodeRef>e</bpmn:flowNodeRef><bpmn:flowNodeRef>t</bpmn:flowNodeRef><bpmn:flowNodeRef>y</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="s" name="Invoice received"><bpmn:outgoing>Flow_1</bpmn:outgoing><bpmn:messageEventDefinition/></bpmn:startEvent>
    <bpmn:userTask id="a" name="Match invoice to purchase order"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="b" name="PO matches?"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing><bpmn:outgoing>Flow_5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:sendTask id="r" name="Return invoice to supplier"><bpmn:incoming>Flow_3</bpmn:incoming><bpmn:outgoing>Flow_4</bpmn:outgoing></bpmn:sendTask>
    <bpmn:endEvent id="xr" name="Invoice returned"><bpmn:incoming>Flow_4</bpmn:incoming></bpmn:endEvent>
    <bpmn:exclusiveGateway id="c" name="Over €5,000?"><bpmn:incoming>Flow_5</bpmn:incoming><bpmn:outgoing>Flow_6</bpmn:outgoing><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="d" name="Approve invoice"><bpmn:incoming>Flow_6</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="g" name="Approved?"><bpmn:incoming>Flow_8</bpmn:incoming><bpmn:outgoing>Flow_9</bpmn:outgoing><bpmn:outgoing>Flow_10</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:endEvent id="z" name="Invoice rejected"><bpmn:incoming>Flow_10</bpmn:incoming></bpmn:endEvent>
    <bpmn:userTask id="e" name="Schedule in next payment run"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:incoming>Flow_9</bpmn:incoming><bpmn:outgoing>Flow_11</bpmn:outgoing></bpmn:userTask>
    <bpmn:intermediateCatchEvent id="t" name="Weekly payment run"><bpmn:incoming>Flow_11</bpmn:incoming><bpmn:outgoing>Flow_12</bpmn:outgoing><bpmn:timerEventDefinition/></bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="y" name="Invoice paid"><bpmn:incoming>Flow_12</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="s" targetRef="a"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="a" targetRef="b"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="b" targetRef="r" name="No"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="r" targetRef="xr"/>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="b" targetRef="c" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_6" sourceRef="c" targetRef="d" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_7" sourceRef="c" targetRef="e" name="No"/>
    <bpmn:sequenceFlow id="Flow_8" sourceRef="d" targetRef="g"/>
    <bpmn:sequenceFlow id="Flow_9" sourceRef="g" targetRef="e" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_10" sourceRef="g" targetRef="z" name="No"/>
    <bpmn:sequenceFlow id="Flow_11" sourceRef="e" targetRef="t"/>
    <bpmn:sequenceFlow id="Flow_12" sourceRef="t" targetRef="y"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true" bioc:stroke="#344054" bioc:fill="#ffffff" color:border-color="#344054" color:background-color="#ffffff"><dc:Bounds x="40" y="40" width="1818" height="520"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_ap_di" bpmnElement="Lane_ap" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="40" width="1784" height="260"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_fm_di" bpmnElement="Lane_fm" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#fcfcfd" color:border-color="#475467" color:background-color="#fcfcfd"><dc:Bounds x="74" y="300" width="1784" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_tr_di" bpmnElement="Lane_tr" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="430" width="1784" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_di" bpmnElement="s" bioc:stroke="#1f7a45" bioc:fill="#e7f6ec" color:background-color="#e7f6ec" color:border-color="#1f7a45"><dc:Bounds x="185" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="148" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="a_di" bpmnElement="a" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="328" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="b_di" bpmnElement="b" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="558" y="80" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="528" y="136" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="r_di" bpmnElement="r" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="708" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="xr_di" bpmnElement="xr" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="945" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="908" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="c_di" bpmnElement="c" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="748" y="210" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="718" y="266" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="d_di" bpmnElement="d" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="898" y="325" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="g_di" bpmnElement="g" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="1128" y="340" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="1098" y="396" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="z_di" bpmnElement="z" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="1325" y="347" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1288" y="389" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e_di" bpmnElement="e" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1278" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="t_di" bpmnElement="t" bioc:stroke="#6941c6" bioc:fill="#f1ebfb" color:background-color="#f1ebfb" color:border-color="#6941c6"><dc:Bounds x="1515" y="477" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1478" y="519" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="y_di" bpmnElement="y" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="1705" y="477" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1668" y="519" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="221" y="105"/><di:waypoint x="328" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="458" y="105"/><di:waypoint x="558" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="608" y="105"/><di:waypoint x="708" y="105"/><bpmndi:BPMNLabel><dc:Bounds x="643" y="85" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="838" y="105"/><di:waypoint x="945" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="583" y="130"/><di:waypoint x="583" y="235"/><di:waypoint x="748" y="235"/><bpmndi:BPMNLabel><dc:Bounds x="589" y="176" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="773" y="260"/><di:waypoint x="773" y="365"/><di:waypoint x="898" y="365"/><bpmndi:BPMNLabel><dc:Bounds x="779" y="306" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="798" y="235"/><di:waypoint x="1248" y="235"/><di:waypoint x="1248" y="495"/><di:waypoint x="1278" y="495"/><bpmndi:BPMNLabel><dc:Bounds x="1008" y="215" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1028" y="365"/><di:waypoint x="1128" y="365"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1153" y="390"/><di:waypoint x="1153" y="495"/><di:waypoint x="1278" y="495"/><bpmndi:BPMNLabel><dc:Bounds x="1159" y="436" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1178" y="365"/><di:waypoint x="1325" y="365"/><bpmndi:BPMNLabel><dc:Bounds x="1236" y="345" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_11_di" bpmnElement="Flow_11" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1408" y="495"/><di:waypoint x="1515" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_12_di" bpmnElement="Flow_12" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1551" y="495"/><di:waypoint x="1705" y="495"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

### Steps and where they come from

| # | Step | BPMN element | Role | Source |
|---|---|---|---|---|
| 1 | Invoice received | Message start event | AP clerk | "Supplier invoices arrive in the AP inbox" |
| 2 | Match invoice to purchase order | User task | AP clerk | "matches each invoice to its purchase order" |
| 3 | PO matches? | Exclusive gateway | AP clerk | "If it doesn't match" |
| 4 | Return invoice to supplier | Send task | AP clerk | "goes back to the supplier with a note" |
| 5 | Over €5,000? | Exclusive gateway | AP clerk | "Matched invoices above €5,000" |
| 6 | Approve invoice | User task | Finance manager | "need sign-off from the finance manager" |
| 7 | Approved? | Exclusive gateway | Finance manager | **Assumption**: the text doesn't say what happens on rejection |
| 8 | Schedule in next payment run | User task | Treasury | "scheduled by treasury in the next weekly payment run" |
| 9 | Weekly payment run | Timer event | Treasury | "next weekly payment run" |
| 10 | Invoice paid / returned / rejected | End events | — | One named outcome per path |

### Open questions for the client

1. **Step 7:** what happens when the finance manager rejects an invoice? Returned to the supplier, or cancelled?
2. **Step 6:** is there an approval deadline, and who is alerted if it's missed?
3. **Step 5:** is the €5,000 threshold before or after VAT?
4. **Step 4:** does a corrected invoice re-enter the process at step 2?

### Improvement opportunities

- **Add a three-way match** (purchase order, goods receipt, invoice). Today the company could pay for goods it never received.
- **Weekly payment runs delay payment by up to 7 days.** Check whether early-payment discounts are being lost.

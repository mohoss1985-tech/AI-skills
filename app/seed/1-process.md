{"client": "Harbor Bank (sample)", "skill": "modeling-processes", "lang": "en", "title": "Visa card authorisation, with stand-in"}
===INPUT===
Model the authorisation of a Visa card payment for our new issuer processing team.

The merchant terminal sends the authorisation request to the acquirer, which checks the merchant and routes it to VisaNet. VisaNet sends it to us, the issuer. We check the card status (blocked, lost, stolen), the funds and limits, and our fraud rules, and answer approved (00) or declined with a response code (51 insufficient funds, 54 expired card, 41 lost card, 43 stolen card, 59 suspected fraud…). If we don't answer in time, VisaNet decides for us in Stand-In Processing (STIP), using our limits and the PANs we listed on the Exception File, and sends us an advice of its decision. The answer goes back to the terminal: approved = sale completed.
===OUTPUT===
**Diagram:** BPMN 2.0 collaboration with four lanes. The only branch that matters to the issuer team is *Issuer available?*: when the issuer host is up it decides; when not, VisaNet decides in STIP with the issuer's parameters and tells the issuer afterwards.

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
    <bpmn:participant id="Participant_1" name="Harbor Bank · Visa card authorisation" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_m" name="Merchant terminal"><bpmn:flowNodeRef>s</bpmn:flowNodeRef><bpmn:flowNodeRef>m1</bpmn:flowNodeRef><bpmn:flowNodeRef>m2</bpmn:flowNodeRef><bpmn:flowNodeRef>e1</bpmn:flowNodeRef><bpmn:flowNodeRef>e2</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_a" name="Acquirer"><bpmn:flowNodeRef>a1</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_v" name="VisaNet"><bpmn:flowNodeRef>v1</bpmn:flowNodeRef><bpmn:flowNodeRef>v2</bpmn:flowNodeRef><bpmn:flowNodeRef>v3</bpmn:flowNodeRef><bpmn:flowNodeRef>v4</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_i" name="Issuer (Harbor Bank)"><bpmn:flowNodeRef>i1</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="s" name="Card presented at checkout"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="m1" name="Send authorisation request"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="a1" name="Check merchant, route to VisaNet"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:exclusiveGateway id="v1" name="Issuer available?"><bpmn:incoming>Flow_3</bpmn:incoming><bpmn:outgoing>Flow_4</bpmn:outgoing><bpmn:outgoing>Flow_5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:serviceTask id="i1" name="Check card status, funds, limits, fraud"><bpmn:incoming>Flow_4</bpmn:incoming><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="v2" name="Stand-In Processing: Exception File and issuer limits"><bpmn:incoming>Flow_5</bpmn:incoming><bpmn:outgoing>Flow_6</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:sendTask id="v3" name="Send STIP advice to issuer"><bpmn:incoming>Flow_6</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:sendTask>
    <bpmn:exclusiveGateway id="v4" name="Approved?"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:incoming>Flow_8</bpmn:incoming><bpmn:outgoing>Flow_9</bpmn:outgoing><bpmn:outgoing>Flow_10</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="m2" name="Complete the sale"><bpmn:incoming>Flow_9</bpmn:incoming><bpmn:outgoing>Flow_11</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="e1" name="Sale completed"><bpmn:incoming>Flow_11</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="e2" name="Declined with response code"><bpmn:incoming>Flow_10</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="s" targetRef="m1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="m1" targetRef="a1"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="a1" targetRef="v1"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="v1" targetRef="i1" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="v1" targetRef="v2" name="No / time-out"/>
    <bpmn:sequenceFlow id="Flow_6" sourceRef="v2" targetRef="v3"/>
    <bpmn:sequenceFlow id="Flow_7" sourceRef="i1" targetRef="v4"/>
    <bpmn:sequenceFlow id="Flow_8" sourceRef="v3" targetRef="v4"/>
    <bpmn:sequenceFlow id="Flow_9" sourceRef="v4" targetRef="m2" name="Yes (00)"/>
    <bpmn:sequenceFlow id="Flow_10" sourceRef="v4" targetRef="e2" name="No"/>
    <bpmn:sequenceFlow id="Flow_11" sourceRef="m2" targetRef="e1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true" bioc:stroke="#344054" bioc:fill="#ffffff" color:border-color="#344054" color:background-color="#ffffff"><dc:Bounds x="40" y="40" width="1818" height="650"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_m_di" bpmnElement="Lane_m" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="40" width="1784" height="260"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_a_di" bpmnElement="Lane_a" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#fcfcfd" color:border-color="#475467" color:background-color="#fcfcfd"><dc:Bounds x="74" y="300" width="1784" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_v_di" bpmnElement="Lane_v" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="430" width="1784" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_i_di" bpmnElement="Lane_i" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#fcfcfd" color:border-color="#475467" color:background-color="#fcfcfd"><dc:Bounds x="74" y="560" width="1784" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_di" bpmnElement="s" bioc:stroke="#1f7a45" bioc:fill="#e7f6ec" color:background-color="#e7f6ec" color:border-color="#1f7a45"><dc:Bounds x="185" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="148" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="m1_di" bpmnElement="m1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="328" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="a1_di" bpmnElement="a1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="518" y="325" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="v1_di" bpmnElement="v1" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="748" y="470" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="718" y="436" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="i1_di" bpmnElement="i1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="898" y="585" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="v2_di" bpmnElement="v2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="898" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="v3_di" bpmnElement="v3" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1088" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="v4_di" bpmnElement="v4" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="1318" y="470" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="1288" y="436" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="m2_di" bpmnElement="m2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1468" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e1_di" bpmnElement="e1" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="1705" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1668" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e2_di" bpmnElement="e2" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="1515" y="217" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1478" y="259" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="221" y="105"/><di:waypoint x="328" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="458" y="105"/><di:waypoint x="488" y="105"/><di:waypoint x="488" y="365"/><di:waypoint x="518" y="365"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="648" y="365"/><di:waypoint x="718" y="365"/><di:waypoint x="718" y="495"/><di:waypoint x="748" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="773" y="520"/><di:waypoint x="773" y="625"/><di:waypoint x="898" y="625"/><bpmndi:BPMNLabel><dc:Bounds x="779" y="566" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="798" y="495"/><di:waypoint x="898" y="495"/><bpmndi:BPMNLabel><dc:Bounds x="833" y="475" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1028" y="495"/><di:waypoint x="1088" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1028" y="625"/><di:waypoint x="1288" y="625"/><di:waypoint x="1288" y="495"/><di:waypoint x="1318" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1218" y="495"/><di:waypoint x="1318" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1343" y="470"/><di:waypoint x="1343" y="105"/><di:waypoint x="1468" y="105"/><bpmndi:BPMNLabel><dc:Bounds x="1349" y="280" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1368" y="495"/><di:waypoint x="1485" y="495"/><di:waypoint x="1485" y="235"/><di:waypoint x="1515" y="235"/><bpmndi:BPMNLabel><dc:Bounds x="1412" y="475" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_11_di" bpmnElement="Flow_11" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1598" y="105"/><di:waypoint x="1705" y="105"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

### Steps and where they come from

| # | Step | BPMN element | Role | Source |
|---|---|---|---|---|
| 1 | Card presented at checkout | Start event | Merchant terminal | "The merchant terminal sends…" |
| 2 | Send authorisation request | Service task | Merchant terminal | "sends the authorisation request to the acquirer" |
| 3 | Check merchant, route to VisaNet | Service task | Acquirer | "checks the merchant and routes it to VisaNet" |
| 4 | Issuer available? | Exclusive gateway | VisaNet | "If we don't answer in time" |
| 5 | Check card status, funds, limits, fraud | Service task | Issuer | "We check the card status…, the funds and limits, and our fraud rules" |
| 6 | Stand-In Processing | Service task | VisaNet | "VisaNet decides for us in STIP, using our limits and the PANs we listed on the Exception File" |
| 7 | Send STIP advice to issuer | Send task | VisaNet | "sends us an advice of its decision" |
| 8 | Approved? | Exclusive gateway | VisaNet | "approved (00) or declined with a response code" |
| 9 | Complete the sale / declined | Task, end events | Merchant terminal | "approved = sale completed" |

### Response codes in the notes

| Code | Meaning | Typical cause on the issuer side |
|---|---|---|
| 00 | Approved | — |
| 51 | Insufficient funds | Balance or credit limit |
| 54 | Expired card | Expiry date passed |
| 41 | Lost card, pick up | PAN declared lost (also on the Exception File for STIP) |
| 43 | Stolen card, pick up | PAN declared stolen |
| 59 | Suspected fraud | Fraud rule hit |

### Open questions for the issuer team

1. **Step 4:** what is our response time-out before STIP takes over, and what are our STIP limits per card product?
2. **Step 6:** how fast is a newly declared lost or stolen PAN added to the Exception File? Hours of delay mean STIP can approve a stolen card.
3. **Step 7:** how do we process STIP advices: posted to the account in real time or in batch?
4. Are 3-D Secure (e-commerce) and offline chip transactions in scope of this model?

### Improvement opportunities

- **Exception File in the same flow as the opposition:** listing the PAN automatically when a card is blocked closes the STIP gap in question 2.
- **Monitor the STIP rate:** a rising share of STIP decisions shows host availability problems before customers complain.

{"client": "Hexa card scheme (sample)", "skill": "modeling-processes", "title": "Card payment lifecycle: authorisation, clearing, settlement"}
===INPUT===
Model the end-to-end life of a card payment in our scheme, for the onboarding pack of new members (issuers and acquirers).

At checkout the merchant's terminal sends an authorisation request to its acquirer, which routes it to us (the scheme). We score the fraud risk (real-time LCLF score) and route the request to the card's issuer. The issuer checks funds, card status and our score, and approves or declines. If the issuer doesn't answer in time, we decide in stand-in (STIP) within the limits the issuer gave us. The response goes back the same way. Declined = the sale stops.

At the end of the day the merchant sends its transactions to the acquirer (télécollecte). The acquirer sends the clearing records to us. We match them to the authorisations, compute the interchange per transaction, and send the records to each issuer, who posts them to the cardholder accounts. We then compute the net position of each member and send the positions for settlement. The acquirer credits the merchant, minus its fees.
===OUTPUT===
**Diagram:** BPMN 2.0 collaboration with four lanes, one per party of the four-party model. Authorisation runs in real time across all four lanes; clearing and settlement run in batch after the end-of-day timer. Open it full screen, or download the `.bpmn` file to edit it in Camunda Modeler, bpmn.io or Signavio.

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
    <bpmn:participant id="Participant_1" name="Hexa card scheme · Card payment lifecycle" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_m" name="Merchant"><bpmn:flowNodeRef>s</bpmn:flowNodeRef><bpmn:flowNodeRef>m1</bpmn:flowNodeRef><bpmn:flowNodeRef>e1</bpmn:flowNodeRef><bpmn:flowNodeRef>m2</bpmn:flowNodeRef><bpmn:flowNodeRef>t1</bpmn:flowNodeRef><bpmn:flowNodeRef>m3</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_a" name="Acquirer"><bpmn:flowNodeRef>a1</bpmn:flowNodeRef><bpmn:flowNodeRef>a2</bpmn:flowNodeRef><bpmn:flowNodeRef>a3</bpmn:flowNodeRef><bpmn:flowNodeRef>e2</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_n" name="Scheme (Hexa)"><bpmn:flowNodeRef>n1</bpmn:flowNodeRef><bpmn:flowNodeRef>g0</bpmn:flowNodeRef><bpmn:flowNodeRef>n2</bpmn:flowNodeRef><bpmn:flowNodeRef>g1</bpmn:flowNodeRef><bpmn:flowNodeRef>n4</bpmn:flowNodeRef><bpmn:flowNodeRef>n5</bpmn:flowNodeRef><bpmn:flowNodeRef>n6</bpmn:flowNodeRef><bpmn:flowNodeRef>n7</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_i" name="Issuer"><bpmn:flowNodeRef>i1</bpmn:flowNodeRef><bpmn:flowNodeRef>i2</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="s" name="Card presented at checkout"><bpmn:outgoing>Flow_1</bpmn:outgoing><bpmn:messageEventDefinition/></bpmn:startEvent>
    <bpmn:serviceTask id="m1" name="Send authorisation request"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="a1" name="Route request to the scheme"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="n1" name="Score fraud risk, route to issuer"><bpmn:incoming>Flow_3</bpmn:incoming><bpmn:outgoing>Flow_4</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:exclusiveGateway id="g0" name="Issuer reachable?"><bpmn:incoming>Flow_4</bpmn:incoming><bpmn:outgoing>Flow_5</bpmn:outgoing><bpmn:outgoing>Flow_6</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:serviceTask id="i1" name="Check funds, card status and score"><bpmn:incoming>Flow_5</bpmn:incoming><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="n2" name="Stand-in authorisation (STIP)"><bpmn:incoming>Flow_6</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:exclusiveGateway id="g1" name="Approved?"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:incoming>Flow_8</bpmn:incoming><bpmn:outgoing>Flow_9</bpmn:outgoing><bpmn:outgoing>Flow_10</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:endEvent id="e1" name="Payment declined"><bpmn:incoming>Flow_9</bpmn:incoming></bpmn:endEvent>
    <bpmn:task id="m2" name="Complete the sale"><bpmn:incoming>Flow_10</bpmn:incoming><bpmn:outgoing>Flow_11</bpmn:outgoing></bpmn:task>
    <bpmn:intermediateCatchEvent id="t1" name="End of day"><bpmn:incoming>Flow_11</bpmn:incoming><bpmn:outgoing>Flow_12</bpmn:outgoing><bpmn:timerEventDefinition/></bpmn:intermediateCatchEvent>
    <bpmn:sendTask id="m3" name="Send the day's transactions"><bpmn:incoming>Flow_12</bpmn:incoming><bpmn:outgoing>Flow_13</bpmn:outgoing></bpmn:sendTask>
    <bpmn:serviceTask id="a2" name="Send clearing records to the scheme"><bpmn:incoming>Flow_13</bpmn:incoming><bpmn:outgoing>Flow_14</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="n4" name="Match to authorisations, compute interchange"><bpmn:incoming>Flow_14</bpmn:incoming><bpmn:outgoing>Flow_15</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:sendTask id="n5" name="Send clearing records to issuers"><bpmn:incoming>Flow_15</bpmn:incoming><bpmn:outgoing>Flow_16</bpmn:outgoing></bpmn:sendTask>
    <bpmn:serviceTask id="i2" name="Post to cardholder accounts"><bpmn:incoming>Flow_16</bpmn:incoming><bpmn:outgoing>Flow_17</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="n6" name="Compute net positions per member"><bpmn:incoming>Flow_17</bpmn:incoming><bpmn:outgoing>Flow_18</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:sendTask id="n7" name="Send positions for settlement"><bpmn:incoming>Flow_18</bpmn:incoming><bpmn:outgoing>Flow_19</bpmn:outgoing></bpmn:sendTask>
    <bpmn:serviceTask id="a3" name="Credit the merchant, net of fees"><bpmn:incoming>Flow_19</bpmn:incoming><bpmn:outgoing>Flow_20</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:endEvent id="e2" name="Merchant paid, members settled"><bpmn:incoming>Flow_20</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="s" targetRef="m1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="m1" targetRef="a1"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="a1" targetRef="n1"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="n1" targetRef="g0"/>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="g0" targetRef="i1" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_6" sourceRef="g0" targetRef="n2" name="No"/>
    <bpmn:sequenceFlow id="Flow_7" sourceRef="i1" targetRef="g1"/>
    <bpmn:sequenceFlow id="Flow_8" sourceRef="n2" targetRef="g1"/>
    <bpmn:sequenceFlow id="Flow_9" sourceRef="g1" targetRef="e1" name="No"/>
    <bpmn:sequenceFlow id="Flow_10" sourceRef="g1" targetRef="m2" name="Yes"/>
    <bpmn:sequenceFlow id="Flow_11" sourceRef="m2" targetRef="t1"/>
    <bpmn:sequenceFlow id="Flow_12" sourceRef="t1" targetRef="m3"/>
    <bpmn:sequenceFlow id="Flow_13" sourceRef="m3" targetRef="a2"/>
    <bpmn:sequenceFlow id="Flow_14" sourceRef="a2" targetRef="n4"/>
    <bpmn:sequenceFlow id="Flow_15" sourceRef="n4" targetRef="n5"/>
    <bpmn:sequenceFlow id="Flow_16" sourceRef="n5" targetRef="i2"/>
    <bpmn:sequenceFlow id="Flow_17" sourceRef="i2" targetRef="n6"/>
    <bpmn:sequenceFlow id="Flow_18" sourceRef="n6" targetRef="n7"/>
    <bpmn:sequenceFlow id="Flow_19" sourceRef="n7" targetRef="a3"/>
    <bpmn:sequenceFlow id="Flow_20" sourceRef="a3" targetRef="e2"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true" bioc:stroke="#344054" bioc:fill="#ffffff" color:border-color="#344054" color:background-color="#ffffff"><dc:Bounds x="40" y="40" width="3528" height="650"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_m_di" bpmnElement="Lane_m" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="40" width="3494" height="260"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_a_di" bpmnElement="Lane_a" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#fcfcfd" color:border-color="#475467" color:background-color="#fcfcfd"><dc:Bounds x="74" y="300" width="3494" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_n_di" bpmnElement="Lane_n" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#f8fafc" color:border-color="#475467" color:background-color="#f8fafc"><dc:Bounds x="74" y="430" width="3494" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_i_di" bpmnElement="Lane_i" isHorizontal="true" bioc:stroke="#475467" bioc:fill="#fcfcfd" color:border-color="#475467" color:background-color="#fcfcfd"><dc:Bounds x="74" y="560" width="3494" height="130"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_di" bpmnElement="s" bioc:stroke="#1f7a45" bioc:fill="#e7f6ec" color:background-color="#e7f6ec" color:border-color="#1f7a45"><dc:Bounds x="185" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="148" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="m1_di" bpmnElement="m1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="328" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="a1_di" bpmnElement="a1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="518" y="325" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n1_di" bpmnElement="n1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="708" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="g0_di" bpmnElement="g0" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="938" y="470" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="908" y="436" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="i1_di" bpmnElement="i1" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1088" y="585" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n2_di" bpmnElement="n2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1088" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="g1_di" bpmnElement="g1" bioc:stroke="#b54708" bioc:fill="#fff6e0" color:background-color="#fff6e0" color:border-color="#b54708"><dc:Bounds x="1318" y="470" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="1288" y="436" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e1_di" bpmnElement="e1" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="1515" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1478" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="m2_di" bpmnElement="m2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1468" y="195" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="t1_di" bpmnElement="t1" bioc:stroke="#6941c6" bioc:fill="#f1ebfb" color:background-color="#f1ebfb" color:border-color="#6941c6"><dc:Bounds x="1705" y="87" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1668" y="129" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="m3_di" bpmnElement="m3" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="1848" y="65" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="a2_di" bpmnElement="a2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2038" y="325" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n4_di" bpmnElement="n4" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2228" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n5_di" bpmnElement="n5" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2418" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="i2_di" bpmnElement="i2" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2608" y="585" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n6_di" bpmnElement="n6" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2798" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="n7_di" bpmnElement="n7" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="2988" y="455" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="a3_di" bpmnElement="a3" bioc:stroke="#1d4ed8" bioc:fill="#e8f0fe" color:background-color="#e8f0fe" color:border-color="#1d4ed8"><dc:Bounds x="3178" y="325" width="130" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e2_di" bpmnElement="e2" bioc:stroke="#b42318" bioc:fill="#fdecec" color:background-color="#fdecec" color:border-color="#b42318"><dc:Bounds x="3415" y="347" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="3378" y="389" width="110" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="221" y="105"/><di:waypoint x="328" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="458" y="105"/><di:waypoint x="488" y="105"/><di:waypoint x="488" y="365"/><di:waypoint x="518" y="365"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="648" y="365"/><di:waypoint x="678" y="365"/><di:waypoint x="678" y="495"/><di:waypoint x="708" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="838" y="495"/><di:waypoint x="938" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="963" y="520"/><di:waypoint x="963" y="625"/><di:waypoint x="1088" y="625"/><bpmndi:BPMNLabel><dc:Bounds x="969" y="566" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="988" y="495"/><di:waypoint x="1088" y="495"/><bpmndi:BPMNLabel><dc:Bounds x="1023" y="475" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1218" y="625"/><di:waypoint x="1288" y="625"/><di:waypoint x="1288" y="495"/><di:waypoint x="1318" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1218" y="495"/><di:waypoint x="1318" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1343" y="470"/><di:waypoint x="1343" y="105"/><di:waypoint x="1515" y="105"/><bpmndi:BPMNLabel><dc:Bounds x="1349" y="280" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1368" y="495"/><di:waypoint x="1438" y="495"/><di:waypoint x="1438" y="235"/><di:waypoint x="1468" y="235"/><bpmndi:BPMNLabel><dc:Bounds x="1388" y="475" width="40" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_11_di" bpmnElement="Flow_11" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1598" y="235"/><di:waypoint x="1675" y="235"/><di:waypoint x="1675" y="105"/><di:waypoint x="1705" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_12_di" bpmnElement="Flow_12" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1741" y="105"/><di:waypoint x="1848" y="105"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_13_di" bpmnElement="Flow_13" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="1978" y="105"/><di:waypoint x="2008" y="105"/><di:waypoint x="2008" y="365"/><di:waypoint x="2038" y="365"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_14_di" bpmnElement="Flow_14" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="2168" y="365"/><di:waypoint x="2198" y="365"/><di:waypoint x="2198" y="495"/><di:waypoint x="2228" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_15_di" bpmnElement="Flow_15" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="2358" y="495"/><di:waypoint x="2418" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_16_di" bpmnElement="Flow_16" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="2548" y="495"/><di:waypoint x="2578" y="495"/><di:waypoint x="2578" y="625"/><di:waypoint x="2608" y="625"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_17_di" bpmnElement="Flow_17" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="2738" y="625"/><di:waypoint x="2768" y="625"/><di:waypoint x="2768" y="495"/><di:waypoint x="2798" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_18_di" bpmnElement="Flow_18" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="2928" y="495"/><di:waypoint x="2988" y="495"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_19_di" bpmnElement="Flow_19" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="3118" y="495"/><di:waypoint x="3148" y="495"/><di:waypoint x="3148" y="365"/><di:waypoint x="3178" y="365"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_20_di" bpmnElement="Flow_20" bioc:stroke="#475467" color:border-color="#475467"><di:waypoint x="3308" y="365"/><di:waypoint x="3415" y="365"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

### Steps and where they come from

| # | Step | BPMN element | Role | Source |
|---|---|---|---|---|
| 1 | Card presented at checkout | Message start event | Merchant | "At checkout the merchant's terminal…" |
| 2 | Send authorisation request | Service task | Merchant | "sends an authorisation request to its acquirer" |
| 3 | Route request to the scheme | Service task | Acquirer | "which routes it to us" |
| 4 | Score fraud risk, route to issuer | Service task | Scheme | "We score the fraud risk (real-time LCLF score) and route" |
| 5 | Issuer reachable? | Exclusive gateway | Scheme | "If the issuer doesn't answer in time" |
| 6 | Check funds, card status and score | Service task | Issuer | "The issuer checks funds, card status and our score" |
| 7 | Stand-in authorisation (STIP) | Service task | Scheme | "we decide in stand-in (STIP) within the limits the issuer gave us" |
| 8 | Approved? | Exclusive gateway | Scheme | "approves or declines… The response goes back the same way" |
| 9 | Payment declined / Complete the sale | End event / task | Merchant | "Declined = the sale stops" |
| 10 | End of day → send the day's transactions | Timer + send task | Merchant | "At the end of the day… (télécollecte)" |
| 11 | Send clearing records to the scheme | Service task | Acquirer | "The acquirer sends the clearing records to us" |
| 12 | Match to authorisations, compute interchange | Service task | Scheme | "We match them to the authorisations, compute the interchange" |
| 13 | Send clearing records to issuers → post to accounts | Send + service task | Scheme → Issuer | "send the records to each issuer, who posts them" |
| 14 | Compute net positions, send for settlement | Service + send task | Scheme | "compute the net position of each member and send the positions" |
| 15 | Credit the merchant, net of fees | Service task | Acquirer | "The acquirer credits the merchant, minus its fees" |

**Simplified on purpose:** the response path (issuer → scheme → acquirer → merchant) is drawn as one gateway, and the cardholder isn't a lane. Add them if the pack is for operations rather than onboarding.

### Open questions for the scheme

1. **Step 5:** what is the issuer response timeout before stand-in, and is it the same for every issuer?
2. **Step 7:** does the issuer receive an advice of every stand-in decision, and how fast?
3. **Step 12:** what happens to a clearing record with **no matching authorisation**: rejected to the acquirer, or cleared with a different interchange?
4. **Step 14:** how often are positions settled (once or several times a day), and through which settlement system?
5. **Disputes** (chargebacks) aren't in the description: model them as a separate process?

### Improvement opportunities

- **Unmatched clearing records** are where fraud and errors hide: a daily KPI of the match rate per acquirer would show problems early.
- **Carry the fraud score into the clearing record**, so fraud reporting and disputes can use the score given at authorisation without a second lookup.

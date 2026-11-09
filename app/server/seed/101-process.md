{"client": "Banque Lumière (exemple)", "skill": "modeling-processes", "lang": "fr", "title": "Autorisation d'un paiement CB, avec traitement de secours"}
===INPUT===
Modélise l'autorisation d'un paiement par carte CB pour la nouvelle équipe monétique émetteur.

Le terminal du commerçant (TPE) envoie la demande d'autorisation à l'acquéreur, qui contrôle le contrat commerçant et la route sur le réseau CB vers nous, l'émetteur. Notre serveur d'autorisation contrôle l'opposition de la carte, les plafonds, le solde et nos règles de fraude, et répond accord (00) ou refus avec un code réponse (51 provision insuffisante, 54 date de validité dépassée, 41 carte perdue, 43 carte volée, 59 suspicion de fraude…). Si nous ne répondons pas à temps, un traitement de secours décide selon nos paramètres et nous informe ensuite. La réponse revient au TPE : accord = vente réalisée.
===OUTPUT===
**Diagramme :** collaboration BPMN 2.0 à quatre couloirs. Le point clé pour l'émetteur est la passerelle *Émetteur joignable ?* : si notre serveur répond, nous décidons ; sinon le traitement de secours décide avec nos paramètres et nous en informe.

### Modèle du processus

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
    <bpmn:participant id="Participant_1" name="Banque Lumière · Autorisation d'un paiement CB" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_m" name="Commerçant (TPE)"><bpmn:flowNodeRef>s</bpmn:flowNodeRef><bpmn:flowNodeRef>m1</bpmn:flowNodeRef><bpmn:flowNodeRef>m2</bpmn:flowNodeRef><bpmn:flowNodeRef>e1</bpmn:flowNodeRef><bpmn:flowNodeRef>e2</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_a" name="Acquéreur"><bpmn:flowNodeRef>a1</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_v" name="Réseau CB"><bpmn:flowNodeRef>v1</bpmn:flowNodeRef><bpmn:flowNodeRef>v2</bpmn:flowNodeRef><bpmn:flowNodeRef>v3</bpmn:flowNodeRef><bpmn:flowNodeRef>v4</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_i" name="Émetteur (Banque Lumière)"><bpmn:flowNodeRef>i1</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="s" name="Carte présentée en caisse"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="m1" name="Envoyer la demande d'autorisation"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="a1" name="Contrôler le contrat, router"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:exclusiveGateway id="v1" name="Émetteur joignable ?"><bpmn:incoming>Flow_3</bpmn:incoming><bpmn:outgoing>Flow_4</bpmn:outgoing><bpmn:outgoing>Flow_5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:serviceTask id="i1" name="Contrôler opposition, plafonds, solde, fraude"><bpmn:incoming>Flow_4</bpmn:incoming><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:serviceTask id="v2" name="Traitement de secours selon les paramètres émetteur"><bpmn:incoming>Flow_5</bpmn:incoming><bpmn:outgoing>Flow_6</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:sendTask id="v3" name="Informer l'émetteur de la décision"><bpmn:incoming>Flow_6</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:sendTask>
    <bpmn:exclusiveGateway id="v4" name="Accord ?"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:incoming>Flow_8</bpmn:incoming><bpmn:outgoing>Flow_9</bpmn:outgoing><bpmn:outgoing>Flow_10</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="m2" name="Finaliser la vente"><bpmn:incoming>Flow_9</bpmn:incoming><bpmn:outgoing>Flow_11</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="e1" name="Vente réalisée"><bpmn:incoming>Flow_11</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="e2" name="Refus avec code réponse"><bpmn:incoming>Flow_10</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="s" targetRef="m1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="m1" targetRef="a1"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="a1" targetRef="v1"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="v1" targetRef="i1" name="Oui"/>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="v1" targetRef="v2" name="Non / délai dépassé"/>
    <bpmn:sequenceFlow id="Flow_6" sourceRef="v2" targetRef="v3"/>
    <bpmn:sequenceFlow id="Flow_7" sourceRef="i1" targetRef="v4"/>
    <bpmn:sequenceFlow id="Flow_8" sourceRef="v3" targetRef="v4"/>
    <bpmn:sequenceFlow id="Flow_9" sourceRef="v4" targetRef="m2" name="Oui (00)"/>
    <bpmn:sequenceFlow id="Flow_10" sourceRef="v4" targetRef="e2" name="Non"/>
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

### Étapes et sources

| # | Étape | Élément BPMN | Rôle | Source |
|---|---|---|---|---|
| 1 | Carte présentée en caisse | Événement de début | Commerçant (TPE) | « Le terminal du commerçant (TPE) envoie… » |
| 2 | Envoyer la demande d'autorisation | Tâche de service | Commerçant | « envoie la demande d'autorisation à l'acquéreur » |
| 3 | Contrôler le contrat, router | Tâche de service | Acquéreur | « contrôle le contrat commerçant et la route sur le réseau CB » |
| 4 | Émetteur joignable ? | Passerelle exclusive | Réseau CB | « Si nous ne répondons pas à temps » |
| 5 | Contrôler opposition, plafonds, solde, fraude | Tâche de service | Émetteur | « contrôle l'opposition de la carte, les plafonds, le solde et nos règles de fraude » |
| 6 | Traitement de secours | Tâche de service | Réseau CB | « un traitement de secours décide selon nos paramètres » |
| 7 | Informer l'émetteur | Tâche d'envoi | Réseau CB | « et nous informe ensuite » |
| 8 | Accord ? | Passerelle exclusive | Réseau CB | « accord (00) ou refus avec un code réponse » |
| 9 | Vente réalisée / refus | Tâche, fins | Commerçant | « accord = vente réalisée » |

### Codes réponse cités

| Code | Signification | Cause côté émetteur |
|---|---|---|
| 00 | Transaction approuvée | — |
| 51 | Provision insuffisante | Solde ou plafond |
| 54 | Date de validité dépassée | Carte expirée |
| 41 | Carte perdue | PAN mis en opposition pour perte |
| 43 | Carte volée | PAN mis en opposition pour vol |
| 59 | Suspicion de fraude | Règle de fraude déclenchée |

### Questions ouvertes pour l'équipe émetteur

1. **Étape 4 :** quel est le délai de réponse au-delà duquel le secours décide, et quels paramètres lui avons-nous confiés ? *(fonctionnement exact du secours sur le réseau CB à confirmer)*
2. **Étape 5 :** une opposition saisie au centre d'appels est-elle prise en compte par le serveur d'autorisation en temps réel ?
3. **Étape 7 :** comment les décisions du secours sont-elles intégrées aux comptes (temps réel ou batch) ?
4. Les paiements sans contact hors ligne et le e-commerce (3-D Secure) sont-ils dans le périmètre ?

### Pistes d'amélioration

- **Opposition et autorisation dans le même flux :** une opposition doit être active à la seconde où elle est enregistrée, y compris pour le secours.
- **Suivre le taux de décisions en secours :** une hausse révèle des problèmes de disponibilité avant les réclamations clients.

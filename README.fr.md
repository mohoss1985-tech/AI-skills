# Compétences IA pour Product Owner · IA conversationnelle, RAG & analyse métier

**Douze compétences IA qui couvrent le travail d'un Product Owner sur un assistant conversationnel et des produits digitaux, une étude de cas bancaire complète, et Analyst Kit, une application qui transforme des notes en livrables prêts à partager.**

🇬🇧 [English version](README.md)

Je suis Product Owner. J'ai construit ce dépôt pour répondre à une question : *quelle part de mon travail produit une IA peut-elle faire au niveau professionnel, si je lui apprends les méthodes que j'utilise vraiment ?* Chaque compétence encode une méthode reconnue (métriques d'évaluation RAG, OWASP Top 10 LLM, INVEST, Gherkin, BPMN 2.0, MoSCoW…). Claude la suit étape par étape et produit un résultat structuré, traçable, prêt pour Jira ou Confluence.

![Parcours « accès bloqué » d'un assistant IA bancaire, généré en BPMN 2.0](examples/banking-ai-support/journey.png)

## Les missions d'un PO d'assistant conversationnel IA, et la compétence qui les outille

| Mission | Compétence |
|---|---|
| **Stratégie & roadmap produit** : prioriser les cas d'usage selon la valeur client, la faisabilité technique et les objectifs business | [AI use-case roadmap](skills/prioritizing-ai-use-cases/SKILL.md) : scoring pondéré, garde-fous risque et connaissance, roadmap Now / Next / Later avec objectifs mesurables |
| **Product ownership & backlog** : user stories et critères d'acceptation, du besoin métier à la mise en production | [User Stories & AC](skills/writing-user-stories/SKILL.md) et [Conversation design](skills/designing-conversational-journeys/SKILL.md) : critères d'acceptation conversationnels en Gherkin |
| **Coordination pluridisciplinaire** : UX/UI, data science, IT, sécurité, experts métiers, rédacteurs | [Conversation design](skills/designing-conversational-journeys/SKILL.md), [Knowledge base curation](skills/curating-knowledge-bases/SKILL.md) (briefs rédacteurs) et [Process Modeler](skills/modeling-processes/SKILL.md) (parcours en BPMN) |
| **Qualité & amélioration continue** : tests des parcours, qualité des réponses RAG, suivi en production | [Xray Test Manager](skills/managing-xray-tests/SKILL.md) : cas de test Xray (manuels, Cucumber, génériques) avec couverture des user stories, fichiers d'import pour Xray Cloud et Server / Data Center, campagnes d'évaluation suivies dans Jira · [RAG evaluation](skills/evaluating-rag-quality/SKILL.md) : jeu de test de référence, fidélité, pertinence, précision et rappel du contexte, seuils go / no-go, analyse des causes, monitoring · script [`score_eval.py`](skills/evaluating-rag-quality/scripts/score_eval.py) |
| **Bases de connaissances** : exploiter les connaissances métiers, réponses contextualisées et fiables | [Knowledge base curation](skills/curating-knowledge-bases/SKILL.md) : audit, couverture, contradictions, standards de rédaction, métadonnées, backlog de contenu |
| **Sécurité & conformité bancaire** | [AI risk & guardrails](skills/governing-ai-risk/SKILL.md) : registre des risques (OWASP LLM 2025), exigences de garde-fous testables, red teaming, points à valider avec le juridique, le DPO et la conformité (AI Act art. 50, RGPD, DORA) |
| **Communication & conduite du changement** : alignement, arbitrages, accompagnement des usages | [Steering & alignment](skills/aligning-stakeholders/SKILL.md) : notes d'arbitrage, comités de pilotage, RACI, notes de version, plan d'adoption |

## ▶ Étude de cas : [IA Support pour l'assistant d'une banque de détail](examples/banking-ai-support/README.md)

Une banque fictive étend son assistant conversationnel à l'accompagnement des clients en difficulté sur leurs espaces digitaux. L'étude de cas déroule toute la boucle, avec les livrables produits par les compétences :

1. **Six cas d'usage priorisés**, dont deux retenus pour le premier trimestre avec un objectif de résultat.
2. **Le parcours « accès bloqué » conçu** et livré en [BPMN](examples/banking-ai-support/journey.bpmn), avec la passation au conseiller et la branche fraude.
3. **L'évaluation des réponses RAG.** Verdict : **no-go**, avec quatre échecs rattachés chacun à une cause et à un responsable.
4. **Le registre des risques** (injection de prompt, fuite de données, tarifs obsolètes, actions non autorisées, conseil réglementé).
5. **Les lacunes de contenu** à l'origine des mauvaises réponses.
6. **La note d'arbitrage** pour le comité de pilotage.

## Également inclus

- **Analyse métier :** [Process Modeler](skills/modeling-processes/SKILL.md) (BPMN 2.0 en couleurs, avec couloirs, ouvrable dans Camunda ou Signavio), [PRD Writer](skills/writing-prds/SKILL.md), [API Test & Documentation](skills/testing-apis/SKILL.md), [SQL Query Generator](skills/generating-sql/SKILL.md).
- **Analyst Kit** : une application minimaliste inspirée de Linear. On colle ses notes, Claude rédige le livrable, on échange avec lui dans un fil de discussion, puis on exporte en Word ou PDF. Chaque compétence a un livrable d'exemple et des scénarios prêts à tester, et un **Guide** (chatbot d'aide instantané) explique les compétences, le vocabulaire et l'application. Voir le [README principal](README.md#analyst-kit-the-app).

Les organisations et les chiffres présentés sont fictifs. Les points réglementaires sont des synthèses, à valider avec les équipes juridique et conformité.

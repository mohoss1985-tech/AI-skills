{"client": "Banque Lumière (exemple)", "lang": "fr", "skill": "managing-backlog", "title": "PI planning : équipe monétique, opposition et impayés"}
===INPUT===
PI planning la semaine prochaine pour l'équipe monétique (SAFe). Projet Jira CARTE. Vélocité ~40 par sprint, 4 sprints + IP. ~10 % de RUN, garder une marge.

F-01 Mise en opposition dans l'application 20/13/13/8, 34 pts, dépend de F-06. Promis avant juin.
F-02 Remboursement des opérations contestées sous J+1 8/13/20/5, 21 pts, dépend de F-06. Obligation légale, ce PI.
F-03 Déclaration de fraude au GIE CB depuis le dossier 13/8/13/8, 30 pts
F-04 Émission des impayés depuis le dossier de fraude 8/3/5/13, 40 pts, dépend de F-03
F-05 Explication des refus de paiement dans l'appli 5/2/2/3, 13 pts
F-06 API d'opposition temps réel sur le serveur d'autorisation (enabler) 3/13/20/5, 21 pts. Dans le PI.
F-07 Suspension des jetons de paiement mobile à l'opposition 8/8/13/3, 13 pts, dépend de F-06
F-08 Blocage par catégorie de commerçant 5/2/3/8, 26 pts
===OUTPUT===
## PI planning · Équipe monétique · Opposition et impayés

### 1 · Hypothèses
- **Capacité :** 4 sprints × 40 = 160 points, moins 10 % de RUN (16) et 15 % de marge (24) → **120 points**. Sprint IP libre.
- **WSJF** = (valeur métier + criticité temporelle + réduction de risque) ÷ taille, calculé avec `wsjf.py`. Une feature entre dans le PI **avec les dépendances dont elle a besoin**.

### 2 · Backlog classé
| Rang | ID | Feature | VM | CT | RR | Taille | WSJF | Points | PI |
|---|---|---|---|---|---|---|---|---|---|
| 1 | F-07 | Suspension des jetons de paiement mobile à l'opposition | 8 | 8 | 13 | 3 | **9.67** | 13 | ✅ dans le PI |
| 2 | F-02 | Remboursement des opérations contestées sous J+1 | 8 | 13 | 20 | 5 | **8.2** | 21 | ✅ dans le PI |
| 3 | F-06 | API d'opposition temps réel sur le serveur d'autorisation | 3 | 13 | 20 | 5 | **7.2** | 21 | ✅ dans le PI |
| 4 | F-01 | Mise en opposition dans l'application | 20 | 13 | 13 | 8 | **5.75** | 34 | ✅ dans le PI |
| 5 | F-03 | Déclaration de fraude au GIE CB depuis le dossier | 13 | 8 | 13 | 8 | **4.25** | 30 | ✅ dans le PI |
| 6 | F-05 | Explication des refus de paiement dans l'appli | 5 | 2 | 2 | 3 | **3.0** | 13 | — hors PI |
| 7 | F-08 | Blocage par catégorie de commerçant | 5 | 2 | 3 | 8 | **1.25** | 26 | — hors PI |
| 8 | F-04 | Émission des impayés depuis le dossier de fraude | 8 | 3 | 5 | 13 | **1.23** | 40 | — hors PI |

**Capacité utilisée : 119 / 120 (99 %).** Les trois features à échéance dans ce PI sont dedans.

**Pourquoi cet ordre**
- **F-07 suspension des jetons** arrive en tête (petite, forte réduction de risque) et entraîne **F-06**, l'API dont elle dépend.
- **F-02 remboursement J+1** : obligation légale (art. L133-18 CMF), d'où sa criticité temporelle.
- **F-04 impayés** attend le PI suivant : elle dépend de F-03 et c'est la plus grosse feature.

### 3 · Plan par sprint
| Sprint | Features | Points |
|---|---|---|
| 1 | F-06 API d'opposition (21) · F-07 jetons (8 sur 13) | 29 |
| 2 | F-07 fin (5) · F-02 remboursement J+1 (21) | 26 |
| 3 | F-01 opposition dans l'appli (34) | 34 |
| 4 | F-03 déclaration de fraude GIE CB (30) | 30 |
| 5 (IP) | Innovation, planification | — |

### 4 · Objectifs du PI
| # | Objectif | Valeur métier (proposée) |
|---|---|---|
| 1 | Une carte en opposition est refusée partout immédiatement, y compris en paiement mobile | 10 |
| 2 | Les opérations contestées sont remboursées dans le délai légal | 10 |
| 3 | Les porteurs font opposition dans l'appli en moins d'une minute | 9 |
| 4 | La fraude confirmée est déclarée au GIE CB le jour même | 7 |

### 5 · Risques (ROAM)
| Risque | ROAM |
|---|---|
| Temps réel vers le serveur d'autorisation en retard | **Porté :** Thomas, point d'étape au sprint 1 |
| Capacité à 99 % | **Accepté :** pas de nouveau périmètre sans retrait |
| Format de déclaration CB non connu | **Mitigé :** à obtenir avant le sprint 4 |

### 6 · Import Jira
jira-import.csv
```csv
Summary,Issue Type,Description,Labels,Labels,Story Points
Suspension des jetons de paiement mobile à l'opposition,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARTE-WSJF,13
Remboursement des opérations contestées sous J+1,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARTE-WSJF,21
API d'opposition temps réel sur le serveur d'autorisation,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARTE-WSJF,21
Mise en opposition dans l'application,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARTE-WSJF,34
Déclaration de fraude au GIE CB depuis le dossier,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARTE-WSJF,30
Explication des refus de paiement dans l'appli,Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARTE-WSJF,13
Blocage par catégorie de commerçant,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARTE-WSJF,26
Émission des impayés depuis le dossier de fraude,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-candidate,CARTE-WSJF,40
```
*Enabler est un type SAFe : remplacez-le par Story si votre Jira ne l'a pas. Testez l'import avec 3 lignes.*

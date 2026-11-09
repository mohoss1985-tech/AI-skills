{"client": "Banque Lumière (exemple)", "lang": "fr", "skill": "analysing-gaps-and-impacts", "title": "Analyse d'impact : contestations et impayés CB hors Excel"}
===INPUT===
Analyse d'écart et d'impact : nous voulons arrêter de traiter les contestations et impayés CB par courrier, e-mail et Excel, et passer à un outil de gestion des litiges relié à la tenue de compte et au GIE CB. 3 mois.

Aujourd'hui : contestations reçues par courrier, e-mail, agence. Équipe impayés (6 personnes) qui ressaisit dans Excel, rembourse à la main (souvent J+3 à J+5), émet les impayés dans le portail de notre processeur. Déclarations de fraude au GIE CB : fichier Excel mensuel. 9 % des impayés perdus l'an dernier pour délai dépassé (~210 k€). 1 100 contestations par mois, 60 % fraude.
===OUTPUT===
## Analyse d'écart et d'impact · Contestations et impayés CB : sortir d'Excel

### 1 · Synthèse pour le sponsor
- **Quoi :** remplacer courrier, e-mails et Excel par un outil de gestion des litiges relié à la tenue de compte et au GIE CB.
- **Pourquoi :** **remboursements à J+3 / J+5** alors que la loi impose la fin du premier jour ouvrable (art. L133-18 CMF), **9 % des impayés perdus** pour délai dépassé (~210 k€), déclarations de fraude mensuelles.
- **Taille :** environ **75–175 jours-homme** sur 6 impacts ; le raccordement à la tenue de compte et la déclaration GIE CB sont le chemin critique.
- **Décisions attendues :** seuil de remboursement automatique ; responsable du suivi des délais.

### 2 · Existant / cible
| Domaine | Existant | Cible | Écart |
|---|---|---|---|
| Réception | Courrier, e-mail, agence, ressaisie Excel | Un dossier par contestation, créé depuis l'appli, le centre d'appels ou l'agence | Manquant |
| Remboursement | Manuel, J+3 à J+5 | Automatique sous un seuil, dans le délai légal | À changer |
| Déclaration de fraude | Fichier Excel mensuel | Déclaration depuis le dossier, avant l'impayé | À changer |
| Impayé | Portail du processeur, à la main | Émis depuis l'outil | À changer |
| Délais | Suivis à la main | Calculés par dossier, alertes avant échéance | Manquant |
| Pilotage | Comptage mensuel | Taux de gain, motifs, délais, remboursements hors délai | Manquant |

### 3 · Traçabilité réglementaire
| Réf. | Exigence (paraphrasée) | Action | Responsable |
|---|---|---|---|
| CMF L133-24 | Le porteur conteste une opération non autorisée dans les 13 mois suivant le débit | Fenêtre de contestation de 13 mois dans l'outil | Impayés |
| CMF L133-18 | Remboursement au plus tard à la fin du premier jour ouvrable suivant le signalement, sauf soupçon de fraude du porteur communiqué à la Banque de France | Remboursement automatique, file d'exception tracée | Impayés, Conformité |
| CMF L133-19 | Franchise éventuelle de 50 € avant opposition, aucune après | Calcul du montant remboursé selon l'heure d'opposition | Juridique |
| Règles CB | Délais et motifs d'impayés, déclaration de fraude au GIE CB | Paramétrage de l'outil | Impayés *(règles CB à confirmer)* |

*Synthèses, à valider par le juridique et la conformité.*

### 4 · Matrice d'impacts
Base : S < 10 j · M 10–40 · L 40–120.

| ID | Domaine | Changement | Taille | Responsable |
|---|---|---|---|---|
| IMP-01 | Applications | Paramétrage de l'outil : motifs, délais, circuit | M (20–40 j) | Responsable impayés |
| IMP-02 | Interfaces | Raccordement processeur pour l'émission des impayés | M–L (30–60 j) | IT monétique |
| IMP-03 | Interfaces | Remboursement automatique vers la tenue de compte | M (10–30 j) | IT comptes |
| IMP-04 | Processus & équipes | Réception depuis l'appli, le centre d'appels, l'agence ; formation | S–M (5–20 j) | Impayés |
| IMP-05 | Conformité | Déclaration de fraude GIE CB depuis le dossier | S–M (5–15 j) | Fraude |
| IMP-06 | Pilotage | Tableau de bord délais et remboursements ; reprise des dossiers ouverts | S (5–10 j) | BI |

**Total :** environ 75–175 jours-homme (somme des fourchettes).

### 5 · Plan de transition
| Mois | Jalon |
|---|---|
| M1 | Outil paramétré, remboursement automatique spécifié, seuil décidé |
| M2 | Raccordements en recette ; pilote sur les contestations de moins de 500 € |
| M3 | Tous les motifs ; reprise des dossiers Excel ; Excel en lecture seule |

### 6 · RAID
| Type | Élément | Responsable |
|---|---|---|
| Risque | Dossiers ouverts perdus pendant la reprise → délais dépassés | Responsable impayés (double suivi en M3) |
| Risque | Raccordement processeur après M2 | IT monétique |
| Hypothèse | 1 100 contestations par mois, 60 % fraude | Impayés |
| Dépendance | Projet de mise en opposition dans l'appli (contestation en ligne) | PO monétique |

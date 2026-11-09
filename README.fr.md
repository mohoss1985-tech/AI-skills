# Analyst Kit · Compétences IA pour la monétique et les API

> **V2 · des outils qui travaillent.** Vingt outils pour BA / PO en monétique : testeur d'API (4 champs, contrôles sans code, export curl / Postman / pytest), SQL sur une base carte, BPMN modifiable, WSJF, recette avec go / no-go, **simulateur de tokenisation** (carte → jeton Apple Pay) et **cycle de vie du paiement et impayés**. [Démo en ligne](https://mohoss1985-tech.github.io/AI-skills/?lang=fr) · [V1 figée](https://mohoss1985-tech.github.io/AI-skills/v1/) · [Journal des versions](CHANGELOG.md)

**Dix-huit compétences IA qui font le travail d'un Business Analyst / Product Owner en monétique, dans une application locale où chaque livrable part de quelques questions précises et de vos propres documents. Les exemples en français suivent les règles CB (Cartes Bancaires) ; les exemples en anglais suivent les règles Visa.**

[![Ouvrir la démo en ligne](https://img.shields.io/badge/%E2%96%B6%20Ouvrir%20la%20d%C3%A9mo%20en%20ligne-5e6ad2?style=for-the-badge)](https://mohoss1985-tech.github.io/AI-skills/)

**[Démo en ligne](https://mohoss1985-tech.github.io/AI-skills/?lang=fr)** : toutes les compétences et les exemples terminés dans votre navigateur, en français (CB) ou en anglais (Visa). En lecture seule : la création de vos propres livrables se fait en local avec Claude Code.

🇬🇧 [English version](README.md)

J'ai travaillé dans un réseau de paiement par carte français. Le métier se situe entre les **émetteurs**, les **acquéreurs** et le réseau : **autorisation**, **mise en opposition et déclaration de fraude** d'un PAN, **impayés**, interchange, compensation et règlement, et les API qui les relient.

Le travail suit toujours la même boucle : atelier, spécification, test d'API, planification, recette, analyse d'impact de la prochaine règle. Et il est fait trois fois : on le **fait** dans un outil, on le **documente**, puis on l'**automatise**.

Ce dépôt le fait une seule fois. Chaque compétence contient la méthode ; l'application la transforme en formulaire guidé : quelques questions courtes, vos documents, et Claude produit le livrable et les fichiers importables (CSV Jira, Xray, SQL, `.bpmn`, pytest).

---

## Trois cas d'usage, deux schémas

| Cas d'usage | Exemples français : **CB** (Banque Lumière, émetteur) | Exemples anglais : **Visa** (Harbor Bank, émetteur) |
|---|---|---|
| **Autorisation** | Réseau CB, serveur d'autorisation de l'émetteur, traitement de secours, codes réponse CB2A (00, 51, 54, 41, 43, 59, 91) | VisaNet, Stand-In Processing, Exception File, codes réponse (00, 51, 54, 41, 43, 59, 1A) |
| **Déclaration d'un PAN** | **Mise en opposition** (perte, vol, utilisation frauduleuse), remboursement au plus tard à J+1 ouvré (art. L133-18 CMF), **déclaration de fraude au GIE CB** | Blocage, inscription du PAN dans l'**Exception File**, **fraud report à Visa** |
| **Impayés** | **Impayés CB**, contestation sous 13 mois (art. L133-24 CMF), déclaration de fraude avant l'impayé | **Conditions de litige Visa** (10 fraude, 11 autorisation, 12 erreurs de traitement, 13 litiges consommateur) |

L'interface affiche les exemples de sa langue. Les éléments que seules les règles du schéma peuvent confirmer (codes motif CB, format et délais de déclaration) sont marqués *à confirmer*.

## Le projet des exemples : la mise en opposition d'une carte

| Étape | Compétence | Français (CB) | Anglais (Visa) |
|---|---|---|---|
| Cadrer | PRD | [Mise en opposition dans l'appli](app/server/seed/103-prd.md) | [Lost or stolen card in the app](app/server/seed/3-prd.md) |
| Atelier | Atelier & compte-rendu | [Notes → compte-rendu](app/server/seed/116-workshop.md) | [Notes → report](app/server/seed/16-workshop.md) |
| Spécifier | Spécification SFD | [Opposition, remboursement, déclaration](app/server/seed/117-sfd.md) | [Block, Exception File, fraud report](app/server/seed/17-sfd.md) |
| User stories | User stories | [Opposition et contestation](app/server/seed/105-stories.md) | [Block and flag](app/server/seed/5-stories.md) |
| Planifier | Backlog & PI planning | [WSJF, objectifs de PI](app/server/seed/121-backlog.md) | [WSJF, PI objectives](app/server/seed/21-backlog.md) |
| Recette | Campagne de recette | [Recette J8](app/server/seed/118-uat.md) | [UAT day 8](app/server/seed/18-uat.md) |
| Déclarer la fraude | Mapping de données | [Dossiers → déclarations GIE CB](app/server/seed/120-mapping.md) | [Fraud cases → Visa fraud reports](app/server/seed/20-mapping.md) |
| Autorisation | Processus (BPMN) | [Autorisation CB avec secours](app/server/seed/101-process.md) | [Visa authorisation with stand-in](app/server/seed/1-process.md) |
| Analyse des refus | Requête SQL | [Taux d'acceptation et codes de refus](app/server/seed/104-sql.md) | [Approval rate and decline codes](app/server/seed/4-sql.md) |
| Impayés (API) | Plan de test API | [API impayés](app/server/seed/102-api.md) | [Disputes API](app/server/seed/2-api.md) |
| Impayés (processus) | Analyse d'impact | [Contestations et impayés hors Excel](app/server/seed/119-impact.md) | [Chargebacks out of spreadsheets](app/server/seed/19-impact.md) |

## Comment un livrable est produit

1. **Choisir un livrable** (classés par phase : cadrer, spécifier, planifier / tester / livrer, IA conversationnelle).
2. **Répondre aux questions rapides :** 3 à 6 réponses courtes et précises par compétence (schéma, phase de recette, type de flux…). Les obligatoires sont marquées *.
3. **Déposer ses documents :** PDF, Word, Excel, PowerPoint, CSV, PNG ou JPEG. Ils sont la **source principale** : Claude les lit d'abord, s'appuie sur eux pour les faits et les chiffres, cite le fichier source et signale les écarts avec vos notes. Le texte des Word, Excel et PowerPoint est extrait en local.
4. **Alimenter la base documentaire** de chaque compétence une fois pour toutes (règles du schéma, procédures internes, modèles).
5. **Recevoir le livrable**, en discuter, ajouter un document plus récent pour le mettre à jour, l'exporter en Word ou PDF.

## L'application

```bash
python3 app/server/server.py      # puis ouvrir http://localhost:4317
```

- **Questions rapides et documents** sur chaque livrable, et une **base documentaire** par compétence.
- **Français et anglais :** le bouton **FR / EN** traduit l'interface, les questions et le Guide, et affiche les exemples et scénarios CB ou Visa.
- **Un exemple terminé et deux scénarios par compétence**, dans chaque langue.
- **Fichiers importables** avec Copier et Télécharger.
- **Guide et assistant Xray :** compétences, vocabulaire (opposition, secours, codes réponse, WSJF, PV de recette…) et application.

Les six compétences de delivery viennent d'une [analyse de 740 missions freelance BA / PO en Île-de-France](market/README.md).

## Autres projets de mon portfolio IA

| Projet | Description |
|---|---|
| [**Fitbit Air on Steroids (MRH1)**](https://github.com/mohoss1985-tech/fitbit-air-on-steroids) · [démo en ligne](https://mohoss1985-tech.github.io/fitbit-air-on-steroids/demo/) | Une app iOS sur mesure (SwiftUI + HealthKit) pour le bracelet Google Fitbit Air : scores façon Whoop, panneaux de santé façon bilan sanguin et chaque mesure expliquée. Réalisée avec Claude. |

Les organisations et les chiffres sont fictifs. Les règles des schémas sont paraphrasées pour les exemples : confirmez codes et délais dans les règles CB ou Visa en vigueur, et les points juridiques avec vos équipes juridique et conformité.

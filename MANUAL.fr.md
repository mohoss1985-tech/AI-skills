# Skills Portal · Manuel utilisateur

Comment utiliser les 20 outils **pour de vrai**, sur vos projets, vos données et vos API — pas seulement dans la démo.

🇬🇧 [English version](MANUAL.md) · 🏠 [README](README.fr.md) · ▶ [Démo en ligne](https://mohoss1985-tech.github.io/AI-skills/?lang=fr)

**Sommaire :** [1. Démo ou local ?](#1-démo-ou-local-) · [2. Installer et lancer](#2-installer-et-lancer-sur-votre-ordinateur) ·
[3. Fonctionnement commun](#3-fonctionnement-commun-à-tous-les-outils) · [4. Outil par outil](#4-outil-par-outil) · [5. Dépannage](#5-dépannage)

---

## 1. Démo ou local ?

| | **Démo en ligne** | **Sur votre ordinateur** |
|---|---|---|
| Pour quoi faire | Essayer les outils, les montrer en entretien | Le vrai travail sur vos projets |
| Vos propres données et exports | ✅ | ✅ |
| Où votre travail est enregistré | Seulement dans ce navigateur (perdu si vous videz le cache) | `app/data/kit.db` sur votre disque |
| Testeur d'API sur vos API | ❌ Le navigateur bloque la plupart des appels (CORS). Seules la simulation Banque Lumière / Harbor Bank et des API publiques d'écho (httpbin.org…) répondent | ✅ Toute API accessible depuis votre poste : interne, VPN, recette, sandbox |
| Proxy de l'entreprise | — | ✅ `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` sont utilisés |
| « Demander à Claude » | Copie un prompt prêt à coller dans Claude | Envoie la demande à une session Claude Code sur votre poste |
| Installation | Aucune | Python 3 et une commande |

**En pratique :** tous les outils sauf le testeur d'API sont pleinement utilisables dans la démo (collez vos données,
lancez, exportez). Passez en local pour enregistrer votre travail sur disque ou pour appeler de vraies API.

---

## 2. Installer et lancer sur votre ordinateur

Rien à installer à part **Python 3** (pas de npm, pas de serveur de base de données, pas de clé d'API). Rien n'est
envoyé ailleurs, sauf les appels d'API que *vous* lancez dans le testeur.

### Étape 1 · Python 3
- **Mac :** ouvrez le Terminal et tapez `python3 --version`. Si macOS propose d'installer les outils de développement, acceptez.
- **Windows :** installez Python depuis [python.org/downloads](https://www.python.org/downloads/) en cochant **« Add python.exe to PATH »**. Utilisez ensuite `python` au lieu de `python3`.
- **Linux :** déjà présent sur la plupart des distributions (`python3 --version`).

### Étape 2 · Récupérer les fichiers
- **Sans git :** sur la [page GitHub](https://github.com/mohoss1985-tech/AI-skills), bouton vert **Code** → **Download ZIP**, puis décompressez (par exemple dans `Documents`).
- **Avec git :** `git clone https://github.com/mohoss1985-tech/AI-skills.git`

### Étape 3 · Lancer
Ouvrez un terminal **dans le dossier décompressé** (Mac : clic droit sur le dossier → *Nouveau terminal au dossier* ;
Windows : ouvrez le dossier, tapez `cmd` dans la barre d'adresse) et lancez :

```bash
python3 app/server/server.py
```

Ouvrez **http://localhost:4317** dans votre navigateur. Gardez le terminal ouvert pendant que vous travaillez ;
**Ctrl + C** pour arrêter. Passez l'interface en français avec **FR** en haut à droite.

### Options
| Vous voulez… | Faites ceci |
|---|---|
| Un autre port (4317 est occupé) | `PORT=4400 python3 app/server/server.py` (Windows : `set PORT=4400` avant) |
| Passer par le proxy de l'entreprise | `export HTTPS_PROXY=http://proxy.monentreprise:8080` avant de lancer (Windows : `set HTTPS_PROXY=…`) |
| Sauvegarder votre travail | Copiez `app/data/kit.db` |
| Passer à une nouvelle version | Téléchargez le nouveau ZIP, puis copiez votre ancien `app/data/kit.db` dans le nouveau dossier |

---

## 3. Fonctionnement commun à tous les outils

Chaque page d'outil a la même organisation : qui en connaît une les connaît toutes.

1. **Arguments de démo** (carte en haut) : *Remplace …*, ce que ça fait, comment ça marche en 3 étapes, et le lien vers la fiche de ce manuel. Repliez-la avec le chevron.
2. **Nouveau** repart de zéro · **Charger un exemple** (Visa EN / CB FR) remplit les champs avec un cas complet. Partez d'un exemple puis remplacez-le par votre contenu : c'est le moyen le plus rapide de voir le format attendu.
3. **Champs** (barre du haut, 3 ou 4 champs) et **réglages** (panneau de gauche). Collez vos notes, CSV, commande curl, etc.
4. **Lancer** (le bouton bleu, ou **⌘↵ / Ctrl+↵** depuis n'importe où). Rien n'est calculé avant d'appuyer.
5. **Résultats** (panneau de droite). La plupart des outils recalculent ensuite en direct.
6. **Barre du bas :**
   - **Enregistrer comme livrable (⌘S)** garde une version datée (en local : dans `kit.db`, visible dans *Livrables*).
   - **Exporter ▾** télécharge les fichiers listés par outil ci-dessous (Markdown toujours disponible).
   - **Demander à Claude ▾** (en local) met une demande en file d'attente ; Claude, dans Claude Code sur le même poste,
     y répond avec `python3 app/server/kit.py pending` puis `kit.py reply …`. Dans la démo : **Copier le prompt pour Claude**.
7. **EN / FR** (en haut à droite) change la langue ; les exemples existent dans les deux (vocabulaire Visa en anglais, CB en français).

Le dernier état de chaque outil est restauré à votre retour. Utilisez **Nouveau** pour commencer un autre travail.

---

## 4. Outil par outil

Format : **Remplace** · **Vous apportez** · **Étapes** · **Vous obtenez** · ⚠️ limites.

### Spécifier

<a id="bpmn-editor"></a>

#### Éditeur BPMN · `#/tool/bpmn-editor`
- **Remplace :** Camunda Modeler / bpmn.io, Visio, Signavio pour un premier jet.
- **Vous apportez :** les acteurs (couloirs) et les étapes, une par ligne (qui fait quoi ; les décisions sous forme de question).
- **Étapes :** saisissez couloirs et étapes → **Lancer** → renommez / déplacez les formes sur le canevas → **Ajuster à l'écran** pour voir tout le processus.
- **Vous obtenez :** `.bpmn` (BPMN 2.0, s'ouvre dans Camunda Modeler et bpmn.io), image `.svg` / `.png`, tableau des étapes `.csv`.

<a id="prd-builder"></a>

#### Générateur de PRD · `#/tool/prd-builder`
- **Remplace :** le modèle de PRD Confluence / Word.
- **Vous apportez :** problème, objectifs, indicateurs écrits *« Nom : actuel → cible »* (ex. « Oppositions faites dans l'appli : 38 % → 70 % »), exigences, hors périmètre.
- **Étapes :** remplissez ou collez vos notes → **Lancer** → vérifiez la traçabilité (chaque objectif → exigence → indicateur).
- **Vous obtenez :** Word `.doc`, Markdown `.md`, CSV d'epic Jira.

<a id="story-builder"></a>

#### Générateur de user stories · `#/tool/story-builder`
- **Remplace :** l'écriture des stories à la main dans Jira + un fichier Gherkin à part.
- **Vous apportez :** règles de gestion ou notes d'atelier, le persona, le nom / l'ID de l'epic.
- **Étapes :** collez les règles → **Lancer** → lisez le contrôle INVEST → découpez une story par règle si elle est trop grosse.
- **Vous obtenez :** CSV Jira (ligne d'epic + stories reliées par `Work item ID` / `Parent` — à importer avec l'import CSV de Jira),
  Gherkin `.feature`, Markdown.

<a id="sfd-builder"></a>

#### Générateur de SFD (spécification fonctionnelle) · `#/tool/sfd-builder`
- **Remplace :** la SFD Word aux règles numérotées à la main.
- **Vous apportez :** les règles de gestion et les champs de données.
- **Étapes :** collez règles et champs → **Lancer** → chaque règle reçoit un identifiant (RG-nn) et est reliée à une story.
- **Vous obtenez :** Word `.doc`, Markdown, Gherkin `.feature`, **CSV des règles** — que le suivi de recette et le générateur Xray
  importent (un test par règle).

### Tester

<a id="api-tester"></a>

#### Testeur d'API · `#/tool/api-tester` — ⚠️ lancez-le en local pour vos propres API
- **Remplace :** Postman / Hoppscotch + le tableur Excel des preuves de recette.
- **Vous apportez :** l'endpoint (ou une commande `curl`, un fichier OpenAPI / Swagger, une collection Postman), l'authentification, l'URL de l'environnement.
- **Étapes :**
  1. Collez dans le champ URL le `curl` envoyé par les développeurs : méthode, en-têtes et corps se remplissent seuls. Ou **Importer un fichier OpenAPI** (JSON / YAML : choisissez un endpoint ou ajoutez-les tous comme cas de test) ou **Importer une collection Postman**.
  2. **Plus → Variables :** renseignez `base_url` (par ex. votre hôte de recette). Changez uniquement cette valeur pour rejouer les mêmes tests ailleurs.
  3. **Auth :** clé d'API, jeton Bearer ou Basic.
  4. **Envoyer** → **cliquez sur une valeur de la réponse** pour en faire un contrôle (ex. `status = BLOCKED`).
  5. **⌘S** l'enregistre comme cas de test ; ajoutez les étapes suivantes ; **Tout lancer**.
- **Vous obtenez :** curl, collection Postman (`skills-portal.postman_collection.json`, s'exécute dans Postman / newman), fichier pytest
  (`skills_portal_api_test.py`, pour la CI des développeurs), rapport de preuves (`.md` / `.csv`) pour votre dossier de recette.
- ⚠️ Dans la démo en ligne, seules la simulation et les API publiques d'écho répondent. En local, une écriture (POST / PUT / PATCH / DELETE)
  vers un hôte qui ressemble à la production demande une confirmation. Utilisez des identifiants de test ; les secrets sont masqués dans l'historique.

<a id="uat-tracker"></a>

#### Suivi de recette · `#/tool/uat-tracker`
- **Remplace :** le tableur de suivi de recette et le mail de statut quotidien.
- **Vous apportez :** les cas de test avec leurs identifiants d'exigence, les résultats du jour (OK / KO / bloqué), les anomalies, les critères de sortie.
- **Étapes :** collez ou importez (dont **Importer depuis le CSV des règles du SFD**) → mettez à jour les résultats chaque jour → **Lancer**.
- **Vous obtenez :** go / no-go motivé, couverture par exigence (couverte / à risque / non couverte), `uat-test-runs.csv`, `uat-defects.csv`.

<a id="xray-builder"></a>

#### Générateur Xray · `#/tool/xray-builder`
- **Remplace :** la construction à la main des fichiers d'import Xray.
- **Vous apportez :** les cas de test (Manual avec étapes, Cucumber / Gherkin, ou Generic / automatisés), la clé du projet, Xray Cloud ou Server / Data Center.
- **Étapes :** collez les tests ou *Ajouter des tests depuis → CSV des règles du SFD…* → **Lancer** → corrigez les erreurs de validation (le téléchargement est bloqué tant qu'il en reste).
- **Vous obtenez :** CSV de tests Xray, JSON d'import en masse, JSON de résultats, et `IMPORT-*.md` avec les étapes d'import exactes.

### Données

<a id="sql-runner"></a>

#### Exécuteur SQL · `#/tool/sql-runner`
- **Remplace :** Metabase / DBeaver sur une copie de la base cartes.
- **Vous apportez :** une question métier (en mots simples) ou une requête SQL.
- **Étapes :** tapez la question (le SQL est proposé hors ligne) ou écrivez le SQL → **Exécuter** → lisez le tableau et le graphique.
- **Vous obtenez :** résultat `.csv`, la requête en `.sql` en syntaxe SQLite, PostgreSQL ou Oracle.
- ⚠️ Les requêtes tournent **uniquement sur la base cartes d'exemple intégrée**. Pour votre vraie base : construisez et vérifiez
  la requête ici, exportez-la dans votre dialecte, exécutez-la dans votre propre outil SQL.

<a id="mapping-grid"></a>

#### Grille de mapping · `#/tool/mapping-grid`
- **Remplace :** le tableur de mapping source → cible.
- **Vous apportez :** champs source, champs cible, règles de transformation, un enregistrement source d'exemple.
- **Étapes :** mappez les champs → **Lancer** → l'enregistrement d'exemple est transformé pour vérifier chaque règle.
- **Vous obtenez :** mapping `.csv`, extraits de transformation `.sql` et `.py` générés.

<a id="tokenization"></a>

#### Simulateur de tokenisation · `#/tool/tokenization`
- **Remplace :** les slides Visa VTS / Mastercard MDES et le schéma de séquence au tableau.
- **Vous apportez :** une carte de test, un wallet (Apple Pay, Google Pay…), un appareil, un token requestor.
- **Étapes :** **Lancer le parcours** → **Suivant ▸** (ou →) affiche chaque message un par un (vert / jaune avec code à usage unique / rouge) →
  puis payer, suspendre, réactiver, remplacer la carte, supprimer le jeton.
- **Vous obtenez :** `tokenization-timeline.csv`, `tokenization-test-cases.json`, le `.json` du parcours — matière pour votre spécification et vos tests.
- ⚠️ Valeurs de démo et PAN de test uniquement ; les noms de champs sont indicatifs — vérifiez-les dans la spécification de votre réseau.

<a id="payment-lifecycle"></a>

#### Cycle de paiement et impayés · `#/tool/payment-lifecycle`
- **Remplace :** la slide du processus d'impayé et le tableur des délais.
- **Vous apportez :** le paiement (montant, réseau Visa / CB, 3-D Secure ou wallet) et ce qui se passe (remboursement, impayé, représentation…).
- **Étapes :** **Lancer** → avancez l'horloge → voyez les délais, les issues (un délai dépassé fait perdre le dossier) et qui porte l'argent.
- **Vous obtenez :** `payment-timeline.csv`, `payment-ledger.csv`, `payment-lifecycle-test-cases.json`, `chargeback-dispute.bpmn`.

### Planifier

<a id="wsjf-planner"></a>

#### Planificateur WSJF et PI · `#/tool/wsjf-planner`
- **Remplace :** Jira Align / le tableur WSJF du PI planning.
- **Vous apportez :** les fonctionnalités avec valeur métier, criticité temporelle, réduction de risque (Fibonacci) et taille ; la capacité de l'équipe.
- **Étapes :** collez ou saisissez les fonctionnalités → **Lancer** → classement WSJF ; ce qui ne tient pas dans le PI est signalé ; une taille vide = « non estimée ».
- **Vous obtenez :** `features.csv`, `jira-import.csv`.

<a id="impact-heatmap"></a>

#### Carte des impacts · `#/tool/impact-heatmap`
- **Remplace :** la matrice d'impact du changement sous Excel.
- **Vous apportez :** le changement, les équipes / domaines touchés, des notes pour équipes, processus, données, SI.
- **Étapes :** remplissez la grille → **Lancer** → carte de chaleur + liste des écarts.
- **Vous obtenez :** `impact-heatmap.csv`, `impact-gaps.csv`.

### Animer

<a id="workshop-kit"></a>

#### Kit d'atelier · `#/tool/workshop-kit`
- **Remplace :** le document d'agenda, le minuteur du téléphone et le fichier de notes.
- **Vous apportez :** l'objectif, les participants, la durée, les sujets.
- **Étapes :** construisez l'agenda (**Ajuster à la durée** reporte les sujets en trop au prochain atelier) → **Lancer** le minuteur → notes et actions en direct.
- **Vous obtenez :** compte-rendu d'atelier, `workshop-actions.csv`. La séance en cours survit à un rechargement de la page.

<a id="raci-grid"></a>

#### RACI et matrice pouvoir · `#/tool/raci-grid`
- **Remplace :** la cartographie des parties prenantes et le tableur RACI.
- **Vous apportez :** les parties prenantes (pouvoir / intérêt) et les décisions.
- **Étapes :** placez les parties prenantes → remplissez le RACI → **Lancer** → le contrôle impose exactement un *Approbateur (A)* par décision.
- **Vous obtenez :** `raci.csv`, `stakeholders.csv`, `decision-memo.md`.

### Gouvernance de l'IA

<a id="use-case-scorer"></a>

#### Notation des cas d'usage · `#/tool/use-case-scorer`
- **Remplace :** le scoring airfocus / Productboard, ou le tableur de priorisation.
- **Vous apportez :** les cas d'usage IA notés en valeur, faisabilité, risque ; les pondérations.
- **Étapes :** remplissez la grille → réglez les pondérations → **Lancer** → feuille de route Maintenant / Ensuite / Plus tard.
- **Vous obtenez :** `ai-use-case-scores.csv`.

<a id="ai-risk-register"></a>

#### Registre des risques IA · `#/tool/ai-risk-register`
- **Remplace :** la check-list AI Act et le tableur des risques.
- **Vous apportez :** le système d'IA, sa finalité et ses utilisateurs, et les réponses aux questions de niveau.
- **Étapes :** répondez à l'assistant → **Lancer** → niveau (Interdit / Haut risque / Transparence / Minimal / *Incomplet*) avec
  le raisonnement, les numéros d'articles, les obligations et les dates → notez le registre des risques.
- **Vous obtenez :** `ai-risk-register.csv`, rapport Markdown.
- ⚠️ Ce n'est pas un avis juridique — faites valider la classification par un juriste.

<a id="rag-eval"></a>

#### Évaluation RAG · `#/tool/rag-eval`
- **Remplace :** les notebooks Ragas / DeepEval et le tableur de revue des réponses.
- **Vous apportez :** un jeu de référence questions / réponses (CSV) et les réponses du bot avec le contexte récupéré (CSV), un seuil de mise en production.
- **Étapes :** collez les deux CSV → **Noter les réponses** → chaque affirmation passe au vert / orange / rouge avec la raison → barrière de mise en production.
- **Vous obtenez :** `eval_results.csv`, `llm_judge_prompt.md` (pour brancher un juge LLM en production).
- ⚠️ La notation par règles détecte nombres, unités, inversions oui / non et termes absents du contexte ; elle ne juge pas les synonymes — utilisez le prompt de juge LLM pour cela.

<a id="journey-builder"></a>

#### Parcours conversationnel · `#/tool/journey-builder`
- **Remplace :** Voiceflow / Botmock / un schéma Miro pour un parcours chatbot ou voix.
- **Vous apportez :** les intentions, des phrases d'exemple, les étapes et les règles de transfert vers un conseiller.
- **Étapes :** construisez le parcours → **Lancer** → discutez avec lui dans le simulateur → **Lancer les phrases de test** pour voir lesquelles atteignent une branche.
- **Vous obtenez :** `.json` du parcours (à réimporter plus tard), schéma Mermaid `.mmd`.

<a id="kb-audit"></a>

#### Audit de base de connaissances · `#/tool/kb-audit`
- **Remplace :** le tableur d'audit de la base de connaissances.
- **Vous apportez :** la liste des articles (CSV : id, titre, responsable, date de dernière revue…) et les principales questions clients avec leurs volumes.
- **Étapes :** collez les deux → **Lancer** → articles périmés, sans responsable, questions sans réponse ; les lignes erronées sont signalées avec leur numéro.
- **Vous obtenez :** `kb-article-audit.csv`, `kb-question-coverage.csv`, `kb-content-backlog.csv`.

---

## 5. Dépannage

| Problème | Solution |
|---|---|
| `python3: command not found` | Installez Python 3 (étape 1). Sous Windows, utilisez `python`. |
| `Address already in use` | Une autre application utilise 4317 : `PORT=4400 python3 app/server/server.py` |
| Testeur d'API : *« Le serveur local ne répond pas »* | Le terminal qui faisait tourner `server.py` a été fermé — relancez-le. |
| Testeur d'API : *« Le navigateur a bloqué cet appel »* | Vous êtes sur la démo en ligne. Lancez l'application en local pour appeler votre API. |
| Testeur d'API : délai dépassé sur une API d'entreprise | Renseignez `HTTPS_PROXY` (section 2 › Options) ou connectez-vous d'abord au VPN. |
| Mon travail a disparu (démo) | La démo n'enregistre que dans ce navigateur. Utilisez l'application locale pour le vrai travail. |
| Un import CSV signale des erreurs de ligne | Lisez le numéro de ligne : en général une virgule dans un texte (mettez-le entre guillemets) ou une date JJ/MM (utilisez AAAA-MM-JJ). |

Données fictives uniquement dans les exemples (Harbor Bank, Banque Lumière). Sans lien avec Visa, Mastercard ni le GIE CB.

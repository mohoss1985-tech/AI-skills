"""Fill-in templates: the structure each skill needs, so the notes box works as an automated template.

Fill what you know, delete what doesn't apply; Claude asks for the rest.
"""

TEMPLATES = {
    "modeling-processes": {
        "en": """Process:
Purpose / trigger (what starts it):
Roles or systems involved (one lane each):
Steps in order (who does what):
1.
2.
3.
Decisions and what happens in each case:
What happens when something fails (time-out, reject, error):
How it ends (each possible outcome):
Volumes, timings, cut-offs: """,
        "fr": """Processus :
Objectif / déclencheur (ce qui le démarre) :
Rôles ou systèmes impliqués (un couloir chacun) :
Étapes dans l'ordre (qui fait quoi) :
1.
2.
3.
Décisions et ce qui se passe dans chaque cas :
Ce qui se passe en cas d'échec (time-out, rejet, erreur) :
Fins possibles :
Volumes, délais, heures limites : """,
    },
    "writing-prds": {
        "en": """Feature:
Problem (who has it, evidence, numbers):
Members / users concerned (issuers, acquirers, merchants, internal teams):
Goal and how we measure success:
Guardrail metrics (what must not get worse: approval rate, latency, fraud…):
Requirements we already know:
Out of scope:
Constraints (regulation, scheme rules, deadline, budget):
Open questions:
Format: one-pager / full PRD""",
        "fr": """Fonctionnalité :
Problème (qui le vit, preuves, chiffres) :
Membres / utilisateurs concernés (émetteurs, acquéreurs, commerçants, équipes internes) :
Objectif et mesure du succès :
Indicateurs garde-fous (ce qui ne doit pas se dégrader : taux d'autorisation, latence, fraude…) :
Exigences déjà connues :
Hors périmètre :
Contraintes (réglementation, règles du schéma, échéance, budget) :
Questions ouvertes :
Format : one-pager / PRD complet""",
    },
    "writing-user-stories": {
        "en": """Feature or requirement IDs:
Users and their role (e.g. issuer Fraud admin, acquirer dispute analyst):
What they need to do:
Business rules and limits (amounts, deadlines, statuses, 4-eyes…):
Edge cases and errors:
When changes take effect (real time, nightly batch, weekly release):
Backlog tool: Jira / Linear / Azure DevOps
Epic / labels: """,
        "fr": """Fonctionnalité ou exigences (identifiants) :
Utilisateurs et rôle (ex. administrateur fraude émetteur, analyste litiges acquéreur) :
Ce qu'ils doivent pouvoir faire :
Règles de gestion et limites (montants, délais, statuts, double validation…) :
Cas limites et erreurs :
Prise d'effet des changements (temps réel, batch de nuit, livraison hebdomadaire) :
Outil de backlog : Jira / Linear / Azure DevOps
Epic / labels : """,
    },
    "testing-apis": {
        "en": """Endpoint(s) (method + path):
Caller (issuer, acquirer, internal) and authentication (OAuth2, mTLS, scopes):
Example request:
Example response:
Business rules (who can call, limits, deadlines, uniqueness, idempotency):
Error cases you know:
Test framework: pytest / Postman / Playwright / other
Spec available: OpenAPI file / none""",
        "fr": """Endpoint(s) (méthode + chemin) :
Appelant (émetteur, acquéreur, interne) et authentification (OAuth2, mTLS, scopes) :
Exemple de requête :
Exemple de réponse :
Règles de gestion (qui peut appeler, limites, délais, unicité, idempotence) :
Cas d'erreur connus :
Outil de test : pytest / Postman / Playwright / autre
Spécification disponible : fichier OpenAPI / aucune""",
    },
    "generating-sql": {
        "en": """Business question:
Who uses the answer and for what decision:
Database: PostgreSQL / BigQuery / Snowflake / SQL Server / Oracle
Tables and columns (paste the DDL or list them):
-
Period and grain (per day, per member, per BIN, per MCC…):
Definitions (what counts as approved, matched, fraud…):
Known traps (duplicates, reversals, time zones, currencies): """,
        "fr": """Question métier :
Qui utilise la réponse et pour quelle décision :
Base de données : PostgreSQL / BigQuery / Snowflake / SQL Server / Oracle
Tables et colonnes (coller le DDL ou les lister) :
-
Période et granularité (par jour, par membre, par BIN, par MCC…) :
Définitions (ce qui compte comme autorisé, rapproché, fraude…) :
Pièges connus (doublons, annulations, fuseaux horaires, devises) : """,
    },
    "facilitating-workshops": {
        "en": """Mode: prepare a workshop / write the report from my notes
Workshop topic and objective:
Date, duration, on site or remote (Klaxoon, Miro, Teams):
Attendees (name, organisation, role) and who was missing:
--- To prepare ---
Topics to cover:
What must be decided by the end:
--- To write the report ---
Raw notes (paste as they are):
""",
        "fr": """Mode : préparer un atelier / rédiger le compte-rendu à partir de mes notes
Sujet et objectif de l'atelier :
Date, durée, sur site ou à distance (Klaxoon, Miro, Teams) :
Participants (nom, organisation, rôle) et absents :
--- Pour préparer ---
Thèmes à couvrir :
Ce qui doit être décidé à la fin :
--- Pour le compte-rendu ---
Notes brutes (à coller telles quelles) :
""",
    },
    "writing-functional-specs": {
        "en": """Level: SFG (general) / SFD (detailed) / review of an existing spec
Feature and context (why, for whom):
Decisions already taken (workshop reports, stories):
Actors and their rights:
Process steps, including errors:
Business rules you know (if… then…):
Screens, fields or message fields concerned:
Systems and interfaces (APIs, files, messages):
Non-functional needs (latency, availability, audit, security):
Out of scope: """,
        "fr": """Niveau : SFG (générales) / SFD (détaillées) / relecture d'une spec existante
Fonctionnalité et contexte (pourquoi, pour qui) :
Décisions déjà prises (comptes-rendus, user stories) :
Acteurs et habilitations :
Étapes du processus, y compris les erreurs :
Règles de gestion connues (si… alors…) :
Écrans, champs ou champs de message concernés :
Systèmes et interfaces (API, fichiers, messages) :
Exigences non fonctionnelles (latence, disponibilité, traçabilité, sécurité) :
Hors périmètre : """,
    },
    "running-uat": {
        "en": """Phase: plan / daily dashboard / closure (go / no-go, PV de recette)
Scope (features, stories, requirements):
Dates, current day and campaign length:
Testers (business, members) and environment (certification platform, recette):
Planned number of test cases:
Exit criteria (default: 100% run, ≥ 95% passed, 0 blocking, 0 major without workaround):
Test execution export (Jira, Xray, Squash, HP ALM): paste below
Defect export: paste below
Decision-maker for the go / no-go: """,
        "fr": """Phase : plan / tableau de bord quotidien / clôture (go / no-go, PV de recette)
Périmètre (fonctionnalités, user stories, exigences) :
Dates, jour en cours et durée de la campagne :
Testeurs (métier, membres) et environnement (plateforme de certification, recette) :
Nombre de cas de test prévus :
Critères de sortie (par défaut : 100 % exécutés, ≥ 95 % OK, 0 bloquant, 0 majeur sans contournement) :
Export des exécutions (Jira, Xray, Squash, HP ALM) : à coller ci-dessous
Export des anomalies : à coller ci-dessous
Décideur du go / no-go : """,
    },
    "analysing-gaps-and-impacts": {
        "en": """Change: regulation / new scheme rule / migration / new product
What changes and the deadline (and where the deadline comes from):
How it works today (process, applications, teams):
Members affected (issuers, acquirers, processors):
Applications and interfaces (authorisation, clearing, settlement, billing, reporting):
Data concerned:
Regulation or rules to trace (IFR, DORA, PSD2, scheme rules…):
Past incidents or lessons from a similar change:
Owners per area: """,
        "fr": """Changement : réglementation / nouvelle règle du schéma / migration / nouveau produit
Ce qui change et l'échéance (et d'où elle vient) :
Fonctionnement actuel (processus, applications, équipes) :
Membres concernés (émetteurs, acquéreurs, processeurs) :
Applications et interfaces (autorisation, compensation, règlement, facturation, reporting) :
Données concernées :
Réglementation ou règles à tracer (IFR, DORA, DSP2, règles du schéma…) :
Incidents passés ou retours d'expérience d'un changement similaire :
Responsables par domaine : """,
    },
    "mapping-data": {
        "en": """Flow: one-off migration / daily batch / real-time API / events
Source system and tables / file layout:
Target system and object (API payload, table):
Volumes (per day, peak):
Record key on both sides (e.g. ARN, auth id):
Source fields (name, type, example):
Target fields and what they need:
Code values to translate (transaction type, entry mode, currency…):
Matching or reconciliation rules (e.g. clearing ↔ authorisation):
Sensitive data (PAN, personal data): """,
        "fr": """Flux : reprise ponctuelle / batch quotidien / API temps réel / événements
Système source et tables / format de fichier :
Système cible et objet (payload API, table) :
Volumes (par jour, en pointe) :
Clé d'un enregistrement des deux côtés (ex. ARN, identifiant d'autorisation) :
Champs source (nom, type, exemple) :
Champs cible et leurs attendus :
Codes à transcoder (type de transaction, mode de lecture, devise…) :
Règles de rapprochement (ex. compensation ↔ autorisation) :
Données sensibles (PAN, données personnelles) : """,
    },
    "managing-backlog": {
        "en": """Framework: Scrum / SAFe (ART name: )
Jira project key:
Team velocity and number of sprints (PI = 4 sprints + IP?):
Run support and buffer:
Candidate features (one per line: ID, title, business value, time criticality, risk reduction, job size, points, depends on, deadline):
F-01
F-02
Fixed deadlines (regulation, scheme release, member commitment):
Dependencies on other teams or members:
Business owner who sets the values: """,
        "fr": """Cadre : Scrum / SAFe (nom de l'ART : )
Clé du projet Jira :
Vélocité de l'équipe et nombre de sprints (PI = 4 sprints + IP ?) :
Support RUN et marge :
Features candidates (une par ligne : ID, titre, valeur métier, criticité temporelle, réduction de risque, taille, points, dépendances, échéance) :
F-01
F-02
Échéances fixes (réglementation, release du schéma, engagement membre) :
Dépendances vers d'autres équipes ou membres :
Business owner qui fixe les valeurs : """,
    },
    "managing-xray-tests": {
        "en": """Xray: Cloud / Server / Data Center / don't know (both)
Jira project key and story keys:
Stories and acceptance criteria (or the test plan): paste below
Who runs the tests: testers by hand / Cucumber / automated suite (pytest, Postman…)
Existing test keys to update:
Test Sets and Test Plan wanted (smoke, regression, release):
Results to import (optional): """,
        "fr": """Xray : Cloud / Server / Data Center / je ne sais pas (les deux)
Clé du projet Jira et clés des user stories :
User stories et critères d'acceptation (ou le plan de test) : à coller ci-dessous
Qui exécute : testeurs manuels / Cucumber / suite automatisée (pytest, Postman…)
Clés de tests existants à mettre à jour :
Test Sets et Test Plan souhaités (smoke, régression, release) :
Résultats à importer (optionnel) : """,
    },
    "aligning-stakeholders": {
        "en": """Deliverable: decision memo / steering committee update / RACI / release notes / change plan
Audience and date:
The decision or message in one sentence:
Options with cost, delay and risk:
Key numbers:
Who thinks what:
Cost of not deciding: """,
        "fr": """Livrable : note d'arbitrage / point de comité de pilotage / RACI / notes de version / plan de conduite du changement
Public et date :
La décision ou le message en une phrase :
Options avec coût, délai et risque :
Chiffres clés :
Qui pense quoi :
Coût de la non-décision : """,
    },
}

# AI-track skills share a lighter template.
_AI = {
    "en": """Assistant and channel:
Users (customers, advisors) and how they log in:
What it can see and do:
Knowledge sources:
Volumes and constraints:
What you need now: """,
    "fr": """Assistant et canal :
Utilisateurs (clients, conseillers) et authentification :
Ce qu'il voit et ce qu'il peut faire :
Sources de connaissance :
Volumes et contraintes :
Ce dont vous avez besoin maintenant : """,
}
for _id in ("prioritizing-ai-use-cases", "designing-conversational-journeys", "evaluating-rag-quality",
            "governing-ai-risk", "curating-knowledge-bases"):
    TEMPLATES.setdefault(_id, _AI)

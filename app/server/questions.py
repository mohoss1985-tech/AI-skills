"""Guided questions: a few short, precise inputs per deliverable, so Claude has what an excellent result needs.

Each question: id, kind (text | select | number), en / fr label, optional en / fr options or placeholder,
and req (required). Answers travel with the request as {id: value}.
"""


def q(id, en, fr, kind="text", req=False, opts=None, ph=None):
    d = {"id": id, "kind": kind, "en": en, "fr": fr, "req": req}
    if opts:
        d["opts"] = {"en": [o[0] for o in opts], "fr": [o[1] for o in opts]}
    if ph:
        d["ph"] = {"en": ph[0], "fr": ph[1]}
    return d


SCHEME = q("scheme", "Card scheme rules", "Règles du schéma", "select",
           opts=[("Visa", "Visa"), ("CB (Cartes Bancaires)", "CB (Cartes Bancaires)"), ("Mastercard", "Mastercard"), ("Not card-related", "Hors cartes")])

QUESTIONS = {
    "facilitating-workshops": [
        q("mode", "What do you need?", "De quoi avez-vous besoin ?", "select", True,
          [("Report from my notes", "Compte-rendu à partir de mes notes"), ("Prepare a workshop", "Préparer un atelier")]),
        q("topic", "Workshop topic", "Sujet de l'atelier", req=True, ph=("e.g. Lost and stolen card declaration", "ex. Mise en opposition des cartes perdues ou volées")),
        q("goal", "What must be decided at the end?", "Que faut-il décider à la fin ?", ph=("e.g. the opposition channels and their deadlines", "ex. les canaux d'opposition et leurs délais")),
        q("people", "Attendees and roles (who was missing?)", "Participants et rôles (qui était absent ?)", ph=("e.g. issuer fraud, call centre, IT cards; Legal absent", "ex. fraude émetteur, centre d'appels, IT monétique ; juridique absent")),
        q("when", "Date and duration", "Date et durée", ph=("e.g. 12 Nov, 2 hours, remote", "ex. 12 nov., 2 heures, à distance")),
        SCHEME,
    ],
    "analysing-gaps-and-impacts": [
        q("change_type", "Type of change", "Type de changement", "select", True,
          [("Regulation", "Réglementation"), ("Scheme rule change (Visa / CB)", "Évolution des règles du schéma (Visa / CB)"), ("System migration", "Migration de système"), ("New product or service", "Nouveau produit ou service")]),
        q("change", "The change in one sentence", "Le changement en une phrase", req=True, ph=("e.g. Chargeback evidence must be sent within 30 days instead of 45", "ex. Les justificatifs d'impayé doivent être envoyés sous 30 jours au lieu de 45")),
        q("deadline", "Deadline and where it comes from", "Échéance et sa source", ph=("e.g. 1 April, scheme bulletin", "ex. 1er avril, bulletin du schéma")),
        q("today", "How it works today, in one line", "Fonctionnement actuel, en une ligne"),
        q("affected", "Teams and systems affected", "Équipes et systèmes concernés", ph=("e.g. dispute back office, card management system", "ex. back-office impayés, système de gestion des cartes")),
        SCHEME,
    ],
    "modeling-processes": [
        q("process", "Which process?", "Quel processus ?", req=True, ph=("e.g. card authorisation with stand-in", "ex. autorisation d'un paiement carte avec secours")),
        q("trigger", "What starts it?", "Qu'est-ce qui le déclenche ?", ph=("e.g. card inserted at the terminal", "ex. carte insérée dans le terminal")),
        q("actors", "Roles or systems involved (one lane each)", "Rôles ou systèmes (un couloir chacun)", ph=("e.g. merchant, acquirer, scheme, issuer", "ex. commerçant, acquéreur, schéma, émetteur")),
        q("end", "How does it end when everything goes well?", "Comment se termine-t-il quand tout va bien ?"),
        q("failures", "What can fail?", "Qu'est-ce qui peut échouer ?", ph=("e.g. issuer time-out, card in opposition", "ex. time-out émetteur, carte en opposition")),
        SCHEME,
    ],
    "writing-prds": [
        q("feature", "Feature", "Fonctionnalité", req=True, ph=("e.g. Lost card declaration in the app", "ex. Mise en opposition dans l'application")),
        q("problem", "Problem in one sentence", "Problème en une phrase", req=True),
        q("evidence", "One number that proves it", "Un chiffre qui le prouve", ph=("e.g. 38% of opposition calls wait over 5 min", "ex. 38 % des appels d'opposition attendent plus de 5 min")),
        q("users", "For whom?", "Pour qui ?", ph=("e.g. cardholders, call-centre agents", "ex. porteurs, conseillers du centre d'appels")),
        q("format", "Format", "Format", "select", opts=[("One-pager", "One-pager"), ("Full PRD", "PRD complet")]),
        q("deadline", "Deadline or constraint", "Échéance ou contrainte"),
    ],
    "writing-functional-specs": [
        q("level", "Level", "Niveau", "select", True,
          [("SFD (detailed)", "SFD (détaillée)"), ("SFG (general)", "SFG (générale)"), ("Review an existing spec", "Relire une spec existante")]),
        q("feature", "Feature", "Fonctionnalité", req=True, ph=("e.g. Fraud declaration on an opposed PAN", "ex. Déclaration de fraude sur un PAN en opposition")),
        q("actors", "Actors and their rights", "Acteurs et habilitations", ph=("e.g. call-centre agent declares, fraud analyst validates", "ex. le conseiller déclare, l'analyste fraude valide")),
        q("systems", "Systems, messages or APIs involved", "Systèmes, messages ou API concernés"),
        q("rules", "Rules you already know", "Règles déjà connues"),
        SCHEME,
    ],
    "writing-user-stories": [
        q("feature", "Feature or requirement IDs", "Fonctionnalité ou identifiants d'exigences", req=True),
        q("role", "Main user role", "Rôle principal", ph=("e.g. cardholder in the mobile app", "ex. porteur dans l'application mobile")),
        q("rules", "Key business rules and limits", "Règles de gestion et limites clés"),
        q("tool", "Backlog tool", "Outil de backlog", "select", opts=[("Jira", "Jira"), ("Azure DevOps", "Azure DevOps"), ("Linear", "Linear")]),
        q("size", "How many stories?", "Combien de stories ?", "select", opts=[("3 to 5", "3 à 5"), ("As many as needed", "Autant que nécessaire")]),
    ],
    "testing-apis": [
        q("endpoint", "Endpoint(s)", "Endpoint(s)", req=True, ph=("e.g. POST /v1/disputes", "ex. POST /v1/impayes")),
        q("caller", "Who calls it?", "Qui l'appelle ?", ph=("e.g. issuer back office", "ex. back-office émetteur")),
        q("auth", "Authentication", "Authentification", "select", opts=[("OAuth2", "OAuth2"), ("OAuth2 + mTLS", "OAuth2 + mTLS"), ("API key", "Clé API"), ("Basic", "Basic")]),
        q("rules", "Business rules to test", "Règles de gestion à tester", ph=("e.g. within 120 days, amount ≤ original", "ex. sous 120 jours, montant ≤ montant initial")),
        q("framework", "Test framework", "Outil de test", "select", opts=[("pytest", "pytest"), ("Postman", "Postman"), ("Playwright", "Playwright"), ("REST Assured", "REST Assured")]),
    ],
    "mapping-data": [
        q("flow", "Type of flow", "Type de flux", "select", True,
          [("One-off migration", "Reprise ponctuelle"), ("Daily file / batch", "Fichier / batch quotidien"), ("Real-time API", "API temps réel"), ("Events", "Événements")]),
        q("source", "Source (system, file or table)", "Source (système, fichier ou table)", req=True),
        q("target", "Target (system, API or table)", "Cible (système, API ou table)", req=True),
        q("key", "Record key on both sides", "Clé d'un enregistrement", ph=("e.g. ARN, PAN token", "ex. ARN, jeton PAN")),
        q("volume", "Volume", "Volume", ph=("e.g. 2M records a day", "ex. 2 M d'enregistrements par jour")),
        q("pan", "Contains card numbers or personal data?", "Contient des numéros de carte ou des données personnelles ?", "select", opts=[("Yes", "Oui"), ("No", "Non")]),
    ],
    "generating-sql": [
        q("question", "Business question", "Question métier", req=True, ph=("e.g. approval rate by response code per day", "ex. taux d'acceptation par code réponse et par jour")),
        q("db", "Database", "Base de données", "select", opts=[("PostgreSQL", "PostgreSQL"), ("Oracle", "Oracle"), ("SQL Server", "SQL Server"), ("BigQuery", "BigQuery"), ("Snowflake", "Snowflake")]),
        q("tables", "Tables and key columns", "Tables et colonnes clés"),
        q("period", "Period", "Période", ph=("e.g. last 30 days", "ex. 30 derniers jours")),
        q("grain", "One row per…", "Une ligne par…", ph=("e.g. day and response code", "ex. jour et code réponse")),
    ],
    "managing-backlog": [
        q("framework", "What do you need?", "De quoi avez-vous besoin ?", "select", True,
          [("SAFe PI planning", "PI planning SAFe"), ("Scrum release plan", "Plan de release Scrum"), ("Backlog review", "Revue de backlog")]),
        q("velocity", "Team velocity (points per sprint)", "Vélocité (points par sprint)", "number"),
        q("sprints", "Number of sprints", "Nombre de sprints", "number"),
        q("deadlines", "Fixed deadlines", "Échéances fixes", ph=("e.g. scheme release 1 April", "ex. release du schéma au 1er avril")),
        q("jira", "Jira project key", "Clé du projet Jira", ph=("e.g. CARD", "ex. CARTE")),
    ],
    "running-uat": [
        q("phase", "Phase", "Phase", "select", True,
          [("Plan the campaign", "Planifier la campagne"), ("Daily dashboard", "Tableau de bord quotidien"), ("Closure: go / no-go and sign-off", "Clôture : go / no-go et PV")]),
        q("scope", "What is tested?", "Qu'est-ce qui est testé ?", req=True, ph=("e.g. card opposition in the app", "ex. mise en opposition dans l'application")),
        q("planned", "Planned test cases", "Cas de test prévus", "number"),
        q("day", "Campaign day", "Jour de campagne", ph=("e.g. day 8 of 10", "ex. J8 sur 10")),
        q("exit", "Exit criteria", "Critères de sortie", "select",
          opts=[("Default: 100% run, ≥ 95% passed, 0 blocking, 0 major without workaround", "Par défaut : 100 % exécutés, ≥ 95 % OK, 0 bloquant, 0 majeur sans contournement"), ("Custom (in my notes)", "Personnalisés (dans mes notes)")]),
        q("tool", "Test tool", "Outil de test", "select", opts=[("Xray", "Xray"), ("Squash", "Squash"), ("HP ALM", "HP ALM"), ("Jira", "Jira"), ("Excel", "Excel")]),
    ],
    "managing-xray-tests": [
        q("flavor", "Xray version", "Version de Xray", "select", True,
          [("Xray Cloud", "Xray Cloud"), ("Server / Data Center", "Server / Data Center"), ("Don't know: both", "Je ne sais pas : les deux")]),
        q("project", "Jira project key", "Clé du projet Jira", ph=("e.g. CARD", "ex. CARTE")),
        q("stories", "Story keys", "Clés des user stories", ph=("e.g. CARD-210 to CARD-214", "ex. CARTE-210 à CARTE-214")),
        q("runner", "Who runs the tests?", "Qui exécute les tests ?", "select",
          opts=[("Manual testers", "Testeurs manuels"), ("Cucumber automation", "Automatisation Cucumber"), ("Automated suite (pytest, Postman…)", "Suite automatisée (pytest, Postman…)")]),
    ],
    "aligning-stakeholders": [
        q("artefact", "Deliverable", "Livrable", "select", True,
          [("Decision memo", "Note d'arbitrage"), ("Steering committee update", "Point de comité de pilotage"), ("RACI", "RACI"), ("Release notes", "Notes de version"), ("Change plan", "Plan de conduite du changement")]),
        q("message", "The decision or message in one sentence", "La décision ou le message en une phrase", req=True),
        q("audience", "Audience and date", "Public et date"),
        q("options", "Options on the table", "Options envisagées"),
    ],
    "prioritizing-ai-use-cases": [
        q("candidates", "Candidate use cases (with monthly volumes)", "Cas d'usage candidats (avec volumes mensuels)", req=True),
        q("capacity", "How many can you launch per quarter?", "Combien pouvez-vous en lancer par trimestre ?", "number"),
        q("regulated", "Regulated topics to keep out", "Sujets réglementés à écarter"),
    ],
    "designing-conversational-journeys": [
        q("need", "Customer need in one sentence", "Besoin client en une phrase", req=True),
        q("solved", "What does 'solved' mean?", "Que veut dire « résolu » ?"),
        q("handoff", "When and to whom to hand off", "Quand et à qui passer la main"),
    ],
    "evaluating-rag-quality": [
        q("phase", "Phase", "Phase", "select", True,
          [("Plan before launch", "Plan avant lancement"), ("Analyse test results", "Analyser des résultats"), ("Monitoring after launch", "Suivi après lancement")]),
        q("scope", "Use cases in scope", "Cas d'usage concernés", req=True),
        q("sources", "Knowledge sources", "Sources de connaissance"),
    ],
    "governing-ai-risk": [
        q("sees", "What the assistant sees", "Ce que voit l'assistant", req=True),
        q("does", "What it can do", "Ce qu'il peut faire", "select", opts=[("Answer only", "Répondre uniquement"), ("Draft for a person", "Rédiger pour une personne"), ("Act on accounts or cards", "Agir sur les comptes ou les cartes")]),
        q("users", "Users", "Utilisateurs", ph=("e.g. authenticated customers", "ex. clients authentifiés")),
        q("hosting", "Model provider and hosting", "Fournisseur du modèle et hébergement"),
    ],
    "curating-knowledge-bases": [
        q("sources", "Content sources and owners", "Sources de contenu et responsables", req=True),
        q("questions", "Top customer questions (with volumes)", "Principales questions clients (avec volumes)"),
        q("writers", "Writers available per week", "Rédacteurs disponibles par semaine", "number"),
    ],
}


def as_text(type_id, answers, lang="en"):
    """Answers as labelled lines, for Claude and for the original notes."""
    lines = []
    for item in QUESTIONS.get(type_id, []):
        v = str((answers or {}).get(item["id"], "")).strip()
        if v:
            lines.append(f"- {item[lang]}: {v}")
    return "\n".join(lines)

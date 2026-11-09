/* SQL runner · guided samples on the Harbor Bank (Visa, EN) / Banque Lumière (CB, FR) dataset.
   Each sample = {id, label, hint, story?, state: {question, tables, dialect, sql, interpretation}, expect}.
   `expect` is the stored answer (checked after a run: "Matches the sample answer"). Answers verified with
   sqlite 3.54 on app/server/tools/sample/cards-sample.sql (see research/wave1-D.md). Owner D. */

const MCC_EN = `-- Approval rate by merchant category, Visa cards (Harbor Bank), October 2026
SELECT mc.label_en                                                        AS merchant_category,
       ROUND(100.0 * SUM(CASE WHEN a.response_code = '00' THEN 1 ELSE 0 END) / COUNT(*), 1) AS approval_pct,
       COUNT(*)                                                           AS auths
FROM authorisations a
JOIN merchants m  ON m.merchant_id = a.merchant_id
JOIN mcc_codes mc ON mc.mcc = m.mcc
WHERE a.scheme = 'VISA'
  AND a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY mc.label_en
ORDER BY approval_pct ASC`;

const MCC_FR = `-- Taux d'acceptation par catégorie de commerçant, cartes CB (Banque Lumière), octobre 2026
SELECT mc.label_fr                                                        AS categorie_commercant,
       ROUND(100.0 * SUM(CASE WHEN a.response_code = '00' THEN 1 ELSE 0 END) / COUNT(*), 1) AS taux_acceptation_pct,
       COUNT(*)                                                           AS autorisations
FROM authorisations a
JOIN merchants m  ON m.merchant_id = a.merchant_id
JOIN mcc_codes mc ON mc.mcc = m.mcc
WHERE a.scheme = 'CB'
  AND a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY mc.label_fr
ORDER BY taux_acceptation_pct ASC`;

const DECL_EN = `-- Top 5 decline codes, Visa cards (Harbor Bank), October 2026
SELECT a.response_code || ' ' || rc.label_en              AS decline_code,
       COUNT(*)                                           AS declines,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS share_pct
FROM authorisations a
JOIN response_codes rc ON rc.code = a.response_code
WHERE rc.is_approval = 0
  AND a.scheme = 'VISA'
  AND a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY a.response_code, rc.label_en
ORDER BY declines DESC
LIMIT 5`;

const DECL_FR = `-- Les 5 premiers motifs de refus, cartes CB (Banque Lumière), octobre 2026
SELECT a.response_code || ' ' || rc.label_fr              AS motif_refus,
       COUNT(*)                                           AS refus,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS part_pct
FROM authorisations a
JOIN response_codes rc ON rc.code = a.response_code
WHERE rc.is_approval = 0
  AND a.scheme = 'CB'
  AND a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY a.response_code, rc.label_fr
ORDER BY refus DESC
LIMIT 5`;

const HOST_EN = `-- Days with the most stand-in (STIP) decisions: a sign of an issuer host problem
SELECT substr(a.auth_ts, 1, 10)                                          AS day,
       ROUND(100.0 * SUM(a.stip) / COUNT(*), 1)                          AS stip_pct,
       COUNT(*)                                                          AS auths,
       SUM(CASE WHEN a.response_code = '91' THEN 1 ELSE 0 END)           AS issuer_unavailable
FROM authorisations a
WHERE a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY day
ORDER BY stip_pct DESC
LIMIT 5`;

const HOST_FR = `-- Jours où l'émetteur était indisponible (91) pour les cartes CB : CB n'a pas de stand-in
SELECT substr(a.auth_ts, 1, 10)                                          AS jour,
       SUM(CASE WHEN a.response_code = '91' THEN 1 ELSE 0 END)           AS emetteur_indisponible,
       COUNT(*)                                                          AS autorisations
FROM authorisations a
WHERE a.scheme = 'CB'
  AND a.auth_ts >= '2026-10-01' AND a.auth_ts < '2026-11-01'
GROUP BY jour
HAVING SUM(CASE WHEN a.response_code = '91' THEN 1 ELSE 0 END) > 0
ORDER BY jour`;

const TESTING = (fr) => `-- ${fr ? "Journées commerçant avec 20 % ou plus de refus 59 (suspicion de fraude), 10 tentatives minimum" : 'Merchant-days where 59 (suspected fraud) is 20 % or more of authorisations, min 10 attempts'}
WITH merchant_days AS (
  -- ${fr ? 'une ligne par commerçant et par jour' : 'one row per merchant and day'}
  SELECT a.merchant_id,
         substr(a.auth_ts, 1, 10)                                AS day,
         COUNT(*)                                                AS auths,
         SUM(CASE WHEN a.response_code = '59' THEN 1 ELSE 0 END) AS n59
  FROM authorisations a
  GROUP BY a.merchant_id, substr(a.auth_ts, 1, 10)
)
SELECT md.day, md.merchant_id, m.name, md.auths, md.n59,
       ROUND(100.0 * md.n59 / md.auths, 1) AS fraud_decline_pct
FROM merchant_days md
JOIN merchants m ON m.merchant_id = md.merchant_id
WHERE md.auths >= 10
  AND 1.0 * md.n59 / md.auths >= 0.2
ORDER BY fraud_decline_pct DESC`;

const DISPUTES = (fr) => `-- ${fr ? 'Litiges hors procédure : 10.x sans déclaration de fraude, ou ouverts après le 120e jour' : 'Disputes that break our procedure: 10.x without a fraud report, or opened after day 120'}
-- ${fr ? "Note : SQLite accepte l'alias « issue » dans le WHERE ; la traduction PostgreSQL / Oracle le réécrit en sous-requête." : 'Note: SQLite accepts the alias "issue" in WHERE; the PostgreSQL / Oracle translation rewrites it as a subquery.'}
SELECT d.dispute_id, d.condition_code, a.auth_ts, d.opened_at,
       CAST(julianday(substr(d.opened_at, 1, 10)) - julianday(substr(a.auth_ts, 1, 10)) AS INTEGER) AS days_after_txn,
       CASE WHEN d.condition_code LIKE '10.%' AND f.fraud_report_id IS NULL THEN 'fraud dispute without fraud report'
            WHEN d.condition_code LIKE '10.%' AND f.auth_id <> d.auth_id    THEN 'fraud report of another transaction'
            WHEN julianday(substr(d.opened_at, 1, 10)) - julianday(substr(a.auth_ts, 1, 10)) > 120 THEN 'opened after day 120'
       END AS issue
FROM disputes d
JOIN authorisations a      ON a.auth_id = d.auth_id
LEFT JOIN fraud_reports f  ON f.fraud_report_id = d.fraud_report_id
WHERE issue IS NOT NULL`;

const STORY_EN = `-- Storyline: approvals after a card was blocked, with the Exception File listing delay
SELECT c.card_id, c.block_reason, c.blocked_at, c.exception_file_listed_at,
       CAST(ROUND((julianday(c.exception_file_listed_at) - julianday(c.blocked_at)) * 1440) AS INTEGER) AS listing_delay_min,
       a.auth_id, a.auth_ts, a.stip, a.amount_minor
FROM cards c
JOIN authorisations a ON a.card_id = c.card_id AND a.auth_ts > c.blocked_at
WHERE c.status = 'blocked'
  AND a.response_code = '00'`;

const STORY_FR = `-- Fil rouge : délai d'inscription en liste d'opposition et paiements acceptés après l'opposition, par carte
SELECT c.card_id, c.issuer, c.block_reason,
       CAST(ROUND((julianday(c.exception_file_listed_at) - julianday(c.blocked_at)) * 1440) AS INTEGER) AS delai_inscription_min,
       COUNT(a.auth_id)                                                                            AS acceptees_apres_opposition
FROM cards c
LEFT JOIN authorisations a ON a.card_id = c.card_id AND a.auth_ts > c.blocked_at AND a.response_code = '00'
WHERE c.status = 'blocked'
GROUP BY c.card_id, c.issuer, c.block_reason, c.blocked_at, c.exception_file_listed_at
ORDER BY delai_inscription_min DESC`;

const s = (id, label, hint, state, expect, story = false) => ({ id, label, hint, story, state: { dialect: 'sqlite', ...state }, expect });

export default {
  en: [
    s('story', 'Stolen card approved in stand-in', 'Storyline · approvals after a block', {
      question: 'Which blocked cards were still approved after the block, and how long did the Exception File listing take?',
      tables: ['cards', 'authorisations'],
      sql: STORY_EN,
      interpretation: 'One approval slipped through: crd_hb_009 (stolen, blocked 18 Oct 09:00) was approved in stand-in at 10:15 (E008, €64.90, stip = 1). The PAN reached the Exception File only at 11:40, 160 min after the block, against a 5 min target. While the issuer host could not answer, stand-in had nothing to refuse on. Follow-up: UAT-05 fails for the same reason; backlog item F-02 automates the listing.',
    }, { rows: 1, first: { card_id: 'crd_hb_009', auth_id: 'E008', stip: 1, listing_delay_min: 160 } }, true),
    s('mcc', 'Approval rate by merchant category', 'Visa · October 2026', {
      question: 'What is the approval rate by merchant category for Visa cards in October 2026?',
      tables: ['authorisations', 'merchants', 'mcc_codes'],
      sql: MCC_EN,
      interpretation: 'Miscellaneous retail (MCC 5999, QuickGift Codes) is far below the rest at 47.4 % approval: the card-testing burst of 17 Oct pulls it down. Every other category sits between 80 % and 91 %; rail is lowest of those (80.6 %).',
    }, { rows: 11, first: { merchant_category: 'Miscellaneous retail', approval_pct: 47.4 } }),
    s('declines', 'Top decline codes', 'Visa · October 2026', {
      question: 'What are the top 5 decline codes for Visa cards in October 2026, and their share of declines?',
      tables: ['authorisations', 'response_codes'],
      sql: DECL_EN,
      interpretation: '51 insufficient funds leads with 44.1 % of declines (more at month end), then 05 do not honour (28.0 %) and 59 suspected fraud (21.3 %). No 91 for Visa: when the host is down, Visa stand-in answers instead.',
    }, { rows: 5, first: { decline_code: '51 Insufficient funds', declines: 93 } }),
    s('host', 'Which day had a host problem?', 'Stand-in share by day', {
      question: 'Which day in October had the highest share of stand-in (STIP) decisions?',
      tables: ['authorisations'],
      sql: HOST_EN,
      interpretation: '14 Oct stands out: 3.8 % of authorisations were decided in stand-in, three times the usual 1.3 %, and it is the only day with 91 issuer unavailable (3 CB cards, which have no stand-in). This is the 13:00–13:59 host outage.',
    }, { first: { day: '2026-10-14', stip_pct: 3.8, issuer_unavailable: 3 } }),
    s('testing', 'Card-testing attack', 'Merchant-days with 59 ≥ 20 %', {
      question: 'Which merchant-days had 20 % or more suspected-fraud declines (59), with at least 10 attempts?',
      tables: ['authorisations', 'merchants'],
      sql: TESTING(false),
      interpretation: 'One merchant-day: QuickGift Codes (M-011) on 17 Oct, 28 of 41 attempts declined 59. That is a card-testing pattern (many small e-commerce attempts in one hour); 12 attempts were approved and became fraud reports.',
    }, { rows: 1, first: { merchant_id: 'M-011', n59: 28, auths: 41 } }),
    s('disputes', 'Disputes that break the procedure', '10.x without fraud report · day 120', {
      question: 'Which disputes break our procedure: a 10.x fraud dispute without a fraud report, or opened after day 120?',
      tables: ['disputes', 'authorisations', 'fraud_reports'],
      sql: DISPUTES(false),
      interpretation: 'Two disputes: DSP-2026-0021 (13.1) was opened 127 days after the transaction, past the 120-day limit; DSP-2026-0022 is a 10.4 fraud dispute with no fraud report. Both would be rejected; fix the case before filing.',
    }, { rows: 2, contains: [['dispute_id', 'DSP-2026-0021'], ['dispute_id', 'DSP-2026-0022']] }),
  ],
  fr: [
    s('story', 'Carte volée acceptée en stand-in', 'Fil rouge · délai de mise en opposition', {
      question: "Pour chaque carte en opposition, combien de temps l'inscription en liste d'opposition a-t-elle pris, et des paiements ont-ils été acceptés après l'opposition ?",
      tables: ['cards', 'authorisations'],
      sql: STORY_FR,
      interpretation: "Banque Lumière inscrit sa carte (crd_bl_002) en 1 min : aucun paiement accepté après l'opposition. Chez Harbor Bank, la carte volée crd_hb_009 a mis 160 min à atteindre l'Exception File (objectif : 5 min) et un paiement a été accepté en stand-in entre-temps. C'est le scénario du cas de recette UAT-05 en échec.",
    }, { rows: 4, first: { card_id: 'crd_hb_009', delai_inscription_min: 160, acceptees_apres_opposition: 1 }, contains: [['card_id', 'crd_bl_002']] }, true),
    s('mcc', 'Taux d’acceptation par catégorie', 'CB · octobre 2026', {
      question: "Quel est le taux d'acceptation par catégorie de commerçant pour les cartes CB en octobre 2026 ?",
      tables: ['authorisations', 'merchants', 'mcc_codes'],
      sql: MCC_FR,
      interpretation: "Les catégories CB vont de 87,5 % à 92,1 % d'acceptation : pas d'anomalie par catégorie. Le commerce de détail divers (MCC 5999) n'a que 8 autorisations, trop peu pour conclure.",
    }, { rows: 11, contains: [['categorie_commercant', 'Pharmacies']] }),
    s('declines', 'Principaux motifs de refus', 'CB · octobre 2026', {
      question: 'Quels sont les 5 premiers motifs de refus des cartes CB en octobre 2026, et leur part ?',
      tables: ['authorisations', 'response_codes'],
      sql: DECL_FR,
      interpretation: "51 provision insuffisante représente 54,0 % des refus, devant 05 ne pas honorer (27,6 %) et 59 suspicion de fraude (12,6 %). Les 3 refus 91 émetteur indisponible viennent de la panne du 14 octobre : CB n'a pas de stand-in.",
    }, { rows: 5, first: { motif_refus: '51 Provision insuffisante', refus: 47 } }),
    s('host', 'Quel jour l’émetteur était-il indisponible ?', 'Refus 91 par jour', {
      question: "Quels jours les cartes CB ont-elles reçu un refus 91 (émetteur indisponible) ?",
      tables: ['authorisations'],
      sql: HOST_FR,
      interpretation: "Un seul jour : le 14 octobre, 3 refus 91 sur 27 autorisations CB, pendant la panne de l'hôte émetteur de 13 h à 14 h. Les cartes Visa ont été traitées en stand-in au même moment.",
    }, { rows: 1, first: { jour: '2026-10-14', emetteur_indisponible: 3 } }),
    s('testing', 'Attaque par test de cartes', 'Journées commerçant avec 59 ≥ 20 %', {
      question: 'Quelles journées commerçant ont 20 % ou plus de refus 59 (suspicion de fraude), avec au moins 10 tentatives ?',
      tables: ['authorisations', 'merchants'],
      sql: TESTING(true),
      interpretation: "Une seule : QuickGift Codes (M-011) le 17 octobre, 28 refus 59 sur 41 tentatives. C'est un test de cartes (beaucoup de petits paiements en ligne en une heure) ; 12 tentatives sont passées et ont donné lieu à des déclarations de fraude.",
    }, { rows: 1, first: { merchant_id: 'M-011', n59: 28 } }),
    s('disputes', 'Litiges hors procédure', '10.x sans déclaration · 120 jours', {
      question: 'Quels litiges ne respectent pas la procédure : 10.x sans déclaration de fraude, ou ouverts après le 120e jour ?',
      tables: ['disputes', 'authorisations', 'fraud_reports'],
      sql: DISPUTES(true),
      interpretation: "Deux litiges : DSP-2026-0021 (13.1) ouvert 127 jours après l'opération, au-delà des 120 jours ; DSP-2026-0022 est un litige fraude 10.4 sans déclaration de fraude. Les deux seraient rejetés. Les motifs d'impayé CB équivalents sont à confirmer.",
    }, { rows: 2, contains: [['dispute_id', 'DSP-2026-0021'], ['dispute_id', 'DSP-2026-0022']] }),
  ],
};

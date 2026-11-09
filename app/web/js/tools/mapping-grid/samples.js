/* Mapping grid samples. EN = Harbor Bank (Visa), FR = Banque Lumière (CB). Fictional data, test PANs only.
   Sample 0 = V1 seed 20-mapping / 120-mapping (fraud case → scheme fraud report), sample record = the storyline:
   crd_hb_009 (token tok_9f3a09, test PAN …1091) approved in stand-in (E008, €64.90 e-commerce) 75 min after the block,
   because the Exception File listing took 160 min. check_mapping.py on it: 0 errors, 8 warnings (intended).
   Sample 1 = ISO 8583 authorisation → internal JSON, with deliberate defects to show every check. */

const m = (source, target, transformation = '', def = '', rule = '') => ({ source, target, transformation, default: def, rule });

const EN_FRAUD = {
  title: 'Fraud cases → Visa fraud reports',
  targetTable: 'fraud_report', key: 'transaction_id', dialect: 'postgres',
  sources: `fraud_case_txn.arn, varchar(23), 74000002305000000007790
fraud_case.card_token, varchar(19), tok_9f3a09
fraud_case.fraud_reason, varchar(15), STOLEN
fraud_case_txn.txn_date, date, 2026-10-18
fraud_case.confirmed_at, timestamp, 2026-10-20T10:30:00Z
fraud_case_txn.amount, decimal(9,2), 64.90
fraud_case_txn.currency, varchar(3), eur
fraud_case_txn.pos_entry, varchar(2), 81
fraud_case.case_no, varchar(12), CASE-0421
fraud_case.analyst, varchar(40), J. Morgan`,
  targets: `transaction_id, varchar(23), Y
pan_token, varchar(19), Y
fraud_type, varchar(2), Y, 0|1|2|3|4|5|6, fraud type values to confirm against the current Visa fraud reporting rules
transaction_date, date, Y
fraud_reported_date, date, Y, , reporting deadline after confirmation to confirm
amount_minor, bigint, Y
currency, varchar(3), Y, EUR|USD|GBP
entry_mode, varchar(12), N, CHIP|CONTACTLESS|ECOM|MAGSTRIPE|MANUAL
case_id, varchar(12), Y`,
  rules: `DQ-01, Uniqueness, One fraud report per transaction (ARN); a case can have several transactions, 100%, Do not send the duplicate, Fraud operations
DQ-02, Validity, Card number is a token: no clear PAN in any field (Luhn-valid 16-digit strings), 100%, Block the file and alert security, Security
DQ-03, Validity, Fraud type and entry mode translate with T-01 and T-02, 100%, Hold the record for the analyst, Fraud operations
DQ-04, Consistency, Fraud reported date is on or after the transaction date, 100%, Hold the record for the analyst, Fraud operations
DQ-05, Validity, Amount is positive and the currency is ISO 4217, 100%, Hold the record, Fraud operations
DQ-06, Timeliness, Reported within the scheme deadline after the fraud is confirmed (deadline to confirm), 99%, Escalate to the fraud manager, Fraud operations`,
  translations: `T-01, LOST, 0, Lost
T-01, STOLEN, 1, Stolen
T-01, NOT_RECEIVED, 2, Card not received as issued
T-01, APPLICATION, 3, Fraudulent application
T-01, COUNTERFEIT, 4, Counterfeit
T-01, OTHER, 5, Miscellaneous
T-01, CNP, 6, Fraudulent use of account number (card not present)
T-02, 05, CHIP, Chip
T-02, 07, CONTACTLESS, Contactless
T-02, 81, ECOM, E-commerce
T-02, 90, MAGSTRIPE, Magnetic stripe
T-02, 01, MANUAL, Manual key entry`,
  map: [
    m('fraud_case_txn.arn', 'transaction_id', 'TRIM(src.arn)', '', 'DQ-01'),
    m('fraud_case.card_token', 'pan_token', 'src.card_token (never the PAN)', '', 'DQ-02'),
    m('fraud_case.fraud_reason', 'fraud_type', 'translation table T-01', '', 'DQ-03'),
    m('fraud_case_txn.txn_date', 'transaction_date', 'src.txn_date', '', 'DQ-04'),
    m('fraud_case.confirmed_at', 'fraud_reported_date', 'CAST(src.confirmed_at AS DATE)', '', 'DQ-04'),
    m('fraud_case_txn.amount', 'amount_minor', 'ROUND(src.amount * 100)', '', 'DQ-05'),
    m('fraud_case_txn.currency', 'currency', 'UPPER(src.currency)', '', 'DQ-05'),
    m('fraud_case_txn.pos_entry', 'entry_mode', 'translation table T-02', '', 'DQ-03'),
    m('fraud_case.case_no', 'case_id', 'src.case_no', '', 'DQ-01'),
  ],
  record: {},
  notes: 'Storyline: crd_hb_009 was blocked as stolen at 09:00 on 18 Oct but listed on the Exception File only at 11:40; E008 (€64.90, e-commerce) was approved in stand-in at 10:15. This is the fraud report for E008.',
};

const EN_ISO = {
  title: 'ISO 8583 authorisation → internal JSON (with defects)',
  targetTable: 'auth_event', key: 'stan', dialect: 'postgres',
  sources: `iso.de2, n..19, 4000000000001091
iso.de3, n6, 000000
iso.de4, n12, 000000006490
iso.de7, n10, 1018101500
iso.de11, n6, 004512
iso.de12, n6, 101500
iso.de22, n3, 812
iso.de38, an6, A1B2C3
iso.de39, an2, 00
iso.de43, ans40, QUICKGIFT ONLINE STORE      LONDON    GB
iso.de49, n3, 978`,
  targets: `pan_masked, varchar(19), Y
amount_minor, bigint, Y
currency, varchar(3), Y, EUR|USD|GBP
txn_time, varchar(10), Y
stan, varchar(6), Y
entry_mode, varchar(12), Y, CHIP|CONTACTLESS|ECOM|MAGSTRIPE|MANUAL
auth_code, varchar(6), N
response_code, varchar(2), Y, 00|05|41|43|51|54|59|91
merchant_name, varchar(25), N
processing_code, varchar(6), N`,
  rules: `DQ-01, Uniqueness, One event per STAN and transmission time, 100%, Drop the duplicate, Card IT
DQ-02, Validity, No clear PAN in the event: masked 6 + 4 only, 100%, Block the stream and alert security, Security
DQ-03, Validity, Currency translates from ISO 4217 numeric (T-01), 100%, Hold the event, Card IT`,
  translations: `T-01, 978, EUR, Euro
T-01, 840, USD, US dollar
T-01, 826, GBP, Pound sterling`,
  map: [
    m('iso.de2', 'pan_masked', 'MASK(src.de2)', '', 'DQ-02'),
    m('iso.de4', 'amount_minor', 'CAST(src.de4 AS BIGINT)'),
    m('iso.de49', 'currency', 'translation table T-01', '', 'DQ-03'),
    m('iso.de7', 'txn_time', 'src.de7', '', 'DQ-01'),
    m('iso.de12', 'txn_time', 'src.de12', '', 'DQ-01'),
    m('iso.de11', 'stan', 'src.de11', '', 'DQ-01'),
    m('iso.de38', 'auth_code'),
    m('iso.de39', 'response_code', '', '', 'DQ-04'),
    m('iso.de43', 'merchant_name'),
  ],
  record: {},
  notes: 'Defects on purpose: txn_time mapped twice, entry_mode (mandatory) not mapped, merchant name 40 → 25 characters, rule DQ-04 unknown. Try mapping de2 straight to pan_masked: the preview blocks the clear PAN.',
};

const FR_FRAUD = {
  title: 'Dossiers de fraude → déclarations GIE CB',
  targetTable: 'declaration_fraude', key: 'reference_operation', dialect: 'postgres',
  sources: `dossier_operation.arn, varchar(23), 74000002305000000006102
dossier_fraude.jeton_carte, varchar(19), tok_7c1b02
dossier_fraude.motif, varchar(15), VAD
dossier_operation.date_op, date, 2026-10-11
dossier_fraude.confirme_le, timestamp, 2026-10-14T09:00:00Z
dossier_operation.montant, decimal(9,2), 59.99
dossier_operation.devise, varchar(3), eur
dossier_operation.mode_saisie, varchar(2), 81
dossier_fraude.num_dossier, varchar(12), CASE-0405
dossier_fraude.analyste, varchar(40), C. Martin`,
  targets: `reference_operation, varchar(23), O, , format de la référence d'opération CB à confirmer
jeton_pan, varchar(19), O
typologie, varchar(15), O, PERTE_VOL|NON_PARVENUE|CONTREFACON|NUMERO_USURPE|AUTRE, codes exacts du format GIE CB à confirmer (liste non publique)
date_operation, date, O
date_declaration, date, O, , délai de déclaration à confirmer
montant_centimes, bigint, O
devise, varchar(3), O, EUR|USD|GBP
mode_lecture, varchar(12), N, PUCE|SANS_CONTACT|VAD|PISTE|MANUEL, codes à confirmer
numero_dossier, varchar(12), O`,
  rules: `DQ-01, Unicité, Une déclaration par opération, 100 %, Ne pas envoyer le doublon, Fraude
DQ-02, Validité, Aucun PAN en clair (suites de 16 chiffres valides Luhn), 100 %, Bloquer le fichier et alerter la sécurité, Sécurité
DQ-03, Validité, Typologie et mode de lecture transcodés (T-01 et T-02), 100 %, Attente analyste, Fraude
DQ-04, Cohérence, Date de déclaration postérieure ou égale à la date de l'opération, 100 %, Attente analyste, Fraude
DQ-05, Validité, Montant positif et devise ISO 4217, 100 %, Attente, Fraude`,
  translations: `T-01, PERTE, PERTE_VOL, Carte perdue
T-01, VOL, PERTE_VOL, Carte volée
T-01, NON_RECUE, NON_PARVENUE, Carte non parvenue
T-01, CONTREFACON, CONTREFACON, Carte contrefaite
T-01, VAD, NUMERO_USURPE, Numéro de carte usurpé
T-01, AUTRE, AUTRE, Autre
T-02, 05, PUCE, Puce
T-02, 07, SANS_CONTACT, Sans contact
T-02, 81, VAD, Vente à distance
T-02, 90, PISTE, Piste magnétique
T-02, 01, MANUEL, Saisie manuelle`,
  map: [
    m('dossier_operation.arn', 'reference_operation', 'TRIM(src.arn)', '', 'DQ-01'),
    m('dossier_fraude.jeton_carte', 'jeton_pan', 'src.jeton_carte (jamais le PAN)', '', 'DQ-02'),
    m('dossier_fraude.motif', 'typologie', 'table de transcodage T-01', '', 'DQ-03'),
    m('dossier_operation.date_op', 'date_operation', 'src.date_op', '', 'DQ-04'),
    m('dossier_fraude.confirme_le', 'date_declaration', 'CAST(src.confirme_le AS DATE)', '', 'DQ-04'),
    m('dossier_operation.montant', 'montant_centimes', 'ROUND(src.montant * 100)', '', 'DQ-05'),
    m('dossier_operation.devise', 'devise', 'UPPER(src.devise)', '', 'DQ-05'),
    m('dossier_operation.mode_saisie', 'mode_lecture', 'table de transcodage T-02', '', 'DQ-03'),
    m('dossier_fraude.num_dossier', 'numero_dossier', 'src.num_dossier', '', 'DQ-01'),
  ],
  record: {},
  notes: "Fil rouge : crd_bl_002 mise en opposition le 12 oct. (usage frauduleux), inscrite sur la liste d'opposition en 1 min ; l'opération E010 (59,99 €, VAD) est déclarée au GIE CB.",
};

const FR_ISO = {
  ...EN_ISO,
  title: 'Autorisation ISO 8583 → JSON interne (avec défauts)',
  targets: EN_ISO.targets.replace(/, Y(\b|$)/g, ', O$1').replace('processing_code, varchar(6), N', 'processing_code, varchar(6), N, , correspondance avec le format CB2A à confirmer'),
  rules: `DQ-01, Unicité, Un événement par STAN et heure de transmission, 100 %, Supprimer le doublon, Informatique carte
DQ-02, Validité, Aucun PAN en clair : masqué 6 + 4 seulement, 100 %, Bloquer le flux et alerter la sécurité, Sécurité
DQ-03, Validité, Devise transcodée depuis le code ISO 4217 numérique (T-01), 100 %, Mettre en attente, Informatique carte`,
  translations: `T-01, 978, EUR, Euro
T-01, 840, USD, Dollar US
T-01, 826, GBP, Livre sterling`,
  sources: EN_ISO.sources.replace('iso.de2, n..19, 4000000000001091', 'iso.de2, n..19, 4000000000002024').replace('QUICKGIFT ONLINE STORE      LONDON    GB', 'BOUTIQUE EN LIGNE LUMIERE  PARIS     FR').replace('000000006490', '000000005999'),
  notes: "Défauts volontaires : txn_time mappé deux fois, entry_mode (obligatoire) non mappé, nom du commerçant 40 → 25 caractères, règle DQ-04 inconnue. Mappez de2 directement sur pan_masked : l'aperçu bloque le PAN en clair.",
};

export const SAMPLES = {
  en: [
    { id: 'visa-fraud-report', label: 'Fraud cases → Visa fraud reports', hint: 'Harbor Bank (sample)', state: EN_FRAUD, autorun: true },
    { id: 'iso8583-json', label: 'ISO 8583 → internal JSON (with defects)', hint: 'Harbor Bank (sample)', state: EN_ISO, autorun: true },
  ],
  fr: [
    { id: 'cb-declaration', label: 'Dossiers de fraude → déclarations GIE CB', hint: 'Banque Lumière (exemple)', state: FR_FRAUD, autorun: true },
    { id: 'iso8583-json', label: 'ISO 8583 → JSON interne (avec défauts)', hint: 'Banque Lumière (exemple)', state: FR_ISO, autorun: true },
  ],
};

/* API tester · samples (owner C). EN = Harbor Bank (Visa terms), FR = Banque Lumière (CB terms).
   Cases follow research/demo-api/*.yaml x-test-cases (TC-01…10, TK-01…06, PL-01…06) with the corrected
   Luhn-valid PANs (research/09 decision 12), plus the 60-second demo and one real call to httpbin.org.
   Storyline: a stolen card approved in stand-in because its Exception File listing took 160 min. */
import { BASES, KEYS } from '../../mock/bank.js';

let seq = 0;
const id = (p) => `${p}_${++seq}`;
const ck = (target, key, op, expected = '') => ({ id: id('chk'), target, key, op, expected: String(expected), on: true });
const st = (n) => ck('status', '', 'eq', n);
const j = (path, op, e) => ck('json', path, op, e);
const auth = { type: 'apikey', key: 'X-API-Key', value: '{{api_key}}', in: 'header', token: '', user: '', pass: '' };
const noAuth = { ...auth, type: 'none' };
function R(name, method, path, body, checks, captures = [], a = auth) {
  return { name, method, url: path.startsWith('http') ? path : '{{base_url}}' + path, auth: { ...a }, params: [], headers: [],
    body: body == null ? '' : JSON.stringify(body, null, 2), checks, captures };
}
const step = (req) => ({ name: req.name, req });
const kase = (cid, name, steps, extra = {}) => ({ id: cid, name, reset: true, steps: steps.map(step), ...extra });

/* Per-bank data. c1 = approved card, c5 = stolen, spare = card for block tests. */
const BANK = {
  en: { brand: 'harbor', issuer: 'Harbor Bank', c1: 'crd_hb_001', pan1: '4000000000001018', exp1: '2029-04', spare: 'crd_hb_008', panS: '4000000000001083', expS: '2029-05',
    c5: 'crd_hb_005', declines: [['4000000000001026', '2028-06', 'pos', '51'], ['4000000000001034', '2026-09', 'pos', '54'], ['4000000000001042', '2028-11', 'pos', '41'], ['4000000000001059', '2029-01', 'pos', '43'], ['4000000000001067', '2029-02', 'ecom', '59']],
    tx: { report: '74000002305000000004418', declined: '74000002305000000005502', declinedCard: 'crd_hb_002', open: '74000002305000000001187', openReport: 'FR-2026-1182', day120: '74000002305000000002265', day121: '74000002305000000003349' },
    red: [['4000000000001059', '2029-01', 'card_blocked_stolen'], ['4000000000001067', '2029-02', 'fraud_watch'], ['4000000000001034', '2026-09', 'card_expired']],
    pay: { hotel: 'pay_0003', hotelAmt: 6500, shoes: 'pay_0001', shoesAmt: 12000, atlas: 'pay_0002', fraudNo3ds: 'pay_0004', fraudNo3dsAmt: 34900, fraud3ds: 'pay_0005', fraud3dsAmt: 21900, report: 'FR-2026-1301' } },
  fr: { brand: 'lumiere', issuer: 'Banque Lumière', c1: 'crd_bl_001', pan1: '4000000000002016', exp1: '2029-04', spare: 'crd_bl_008', panS: '4000000000002081', expS: '2029-05',
    c5: 'crd_bl_005', declines: [['4000000000002065', '2028-06', 'pos', '51'], ['4000000000002073', '2026-09', 'pos', '54'], ['4000000000002040', '2028-11', 'pos', '41'], ['4000000000002057', '2029-01', 'pos', '43'], ['4000000000002099', '2029-02', 'ecom', '59'], ['4000000000002024', '2028-12', 'pos', '05']],
    tx: { report: '74000002306000000004418', declined: '74000002306000000005502', declinedCard: 'crd_bl_006', open: '74000002306000000001187', openReport: 'FR-2026-2182', day120: '74000002306000000002265', day121: '74000002306000000003349' },
    red: [['4000000000002057', '2029-01', 'card_blocked_stolen'], ['4000000000002099', '2029-02', 'fraud_watch'], ['4000000000002073', '2026-09', 'card_expired']],
    pay: { hotel: 'pay_0003', hotelAmt: 1240, shoes: 'pay_0001', shoesAmt: 7900, atlas: 'pay_0002', fraudNo3ds: 'pay_0004', fraudNo3dsAmt: 6000, fraud3ds: 'pay_0005', fraud3dsAmt: 14000, report: 'FR-2026-2301' } },
};
const N = {
  en: {
    demo: '60-second demo: block a lost card, then the payment is declined (41)',
    demo1: 'Declare the card lost', demo2: 'Pay with the blocked card', demo3: 'Try to unblock it',
    tc01: 'TC-01 No API key is refused', tc02: 'TC-02 Card read never exposes the PAN', tc03: 'TC-03 Approved contactless payment',
    tc04: 'TC-04 Each decline code (one row per card)', tc05: 'TC-05 Stand-In Processing decides when the issuer is down',
    tc05a: 'EUR 45.00 in stand-in: approved', tc05b: 'EUR 250.00 in stand-in: declined 05',
    tc06: 'TC-06 Block as stolen: card refused with 43, tokens suspended', tc06a: 'Block as stolen', tc06b: 'Authorise after the block', tc06c: 'Block again',
    tc07: 'TC-07 A stolen card cannot be unblocked; a lost one can', tc07a: 'Unblock the stolen card', tc07b: 'Block the spare card as lost', tc07c: 'Unblock it',
    tc08: 'TC-08 Fraud report sent once per transaction', tc08a: 'Report the fraud', tc08b: 'Report it again', tc08c: 'Report a declined transaction',
    tc09: 'TC-09 Fraud dispute needs the fraud report first', tc09a: '10.4 without a fraud report', tc09b: '10.4 on a transaction already disputed',
    tc10: 'TC-10 120-day limit, inclusive', tc10a: 'Day 120: accepted', tc10b: 'Day 121: refused',
    http: 'Real internet call: httpbin.org echoes a masked payment',
    tk01: 'TK-01 Green path: card added to Apple Pay at once', tk02: 'TK-02 Yellow path: one-time code activates the token', tk02a: 'Ask for a token (new device)', tk02b: 'Wrong code', tk02c: 'Right code (123456)',
    tk03: 'TK-03 Red path: blocked, fraud-watch or expired cards get no token', tk04: 'TK-04 Demo cryptogram is single-use and respects domain restrictions',
    tk04a: 'Provision a token', tk04b: 'Get a demo cryptogram', tk04c: 'Pay with the token', tk04d: 'Replay the cryptogram', tk04e: 'Use it as card-on-file',
    tk05: 'TK-05 Storyline: stolen card suspends the token, PAN update on the replacement', tk05a: 'Add the card to a phone', tk05b: 'Block the card as stolen', tk05c: 'Pay with the phone', tk05d: 'Resume without a new card', tk05e: 'Resume on the replacement card',
    tk06: 'TK-06 Lifecycle: delete is final', tk06a: 'Resume an active token', tk06b: 'Suspend (phone lost)', tk06c: 'Delete', tk06d: 'Resume a deleted token',
    pl01: 'PL-01 Cancel before clearing is a reversal, not a refund', pl01a: 'Refund before clearing', pl01b: 'Reverse', pl01c: 'Capture after reversal',
    pl02: 'PL-02 After clearing, cancel becomes a refund', pl02a: 'Reverse a cleared payment', pl02b: 'Refund EUR 40', pl02c: 'Refund more than what is left',
    pl03: 'PL-03 Goods not received: merchant wins with proof of delivery', pl03a: 'Raise 13.1', pl03b: 'Represent with proof of delivery', pl03c: 'Refund after the dispute closed',
    pl04: 'PL-04 Fraud on a stolen card: liability depends on 3-D Secure', pl04a: '10.4 on a 3DS payment', pl04b: '10.4 without the fraud report', pl04c: '10.4 with the fraud report',
    pl05: 'PL-05 Missed response window: merchant loses by default', pl05a: 'Raise 13.1', pl05b: 'Move the clock 31 days', pl05c: 'Represent too late',
    pl06: 'PL-06 Weak evidence: pre-arbitration, then arbitration with a fee', pl06a: 'Raise 13.1', pl06b: 'Represent with tracking only', pl06c: 'Decline the pre-arbitration',
  },
  fr: {
    demo: 'Démo 60 secondes : opposition sur une carte perdue, puis le paiement est refusé (41)',
    demo1: 'Déclarer la carte perdue', demo2: 'Payer avec la carte en opposition', demo3: 'Tenter de la réactiver',
    tc01: 'TC-01 Sans clé d\'API : refusé', tc02: 'TC-02 La lecture de carte ne montre jamais le PAN', tc03: 'TC-03 Paiement sans contact accepté',
    tc04: 'TC-04 Chaque code de refus (une ligne par carte)', tc05: 'TC-05 Émetteur indisponible sans traitement de secours : 91',
    tc05a: 'Carte d\'un émetteur indisponible', tc05b: '',
    tc06: 'TC-06 Opposition pour vol : carte refusée en 43, jetons suspendus', tc06a: 'Opposition pour vol', tc06b: 'Autorisation après l\'opposition', tc06c: 'Nouvelle opposition',
    tc07: 'TC-07 Une carte volée ne se réactive pas ; une carte perdue oui', tc07a: 'Réactiver la carte volée', tc07b: 'Opposition « perte » sur la carte de réserve', tc07c: 'La réactiver',
    tc08: 'TC-08 Une seule déclaration de fraude par opération', tc08a: 'Déclarer la fraude', tc08b: 'La déclarer à nouveau', tc08c: 'Déclarer une opération refusée',
    tc09: 'TC-09 Un impayé fraude exige d\'abord la déclaration de fraude', tc09a: '10.4 sans déclaration de fraude', tc09b: '10.4 sur une opération déjà contestée',
    tc10: 'TC-10 Délai de 120 jours, inclus', tc10a: 'Jour 120 : accepté', tc10b: 'Jour 121 : refusé',
    http: 'Vrai appel Internet : httpbin.org renvoie un paiement masqué',
    tk01: 'TK-01 Parcours vert : carte ajoutée à Apple Pay tout de suite', tk02: 'TK-02 Parcours orange : un code à usage unique active le jeton', tk02a: 'Demander un jeton (nouvel appareil)', tk02b: 'Code erroné', tk02c: 'Bon code (123456)',
    tk03: 'TK-03 Parcours rouge : carte en opposition, sous surveillance ou expirée', tk04: 'TK-04 Le cryptogramme de démo sert une fois et respecte le domaine',
    tk04a: 'Créer un jeton', tk04b: 'Obtenir un cryptogramme de démo', tk04c: 'Payer avec le jeton', tk04d: 'Rejouer le cryptogramme', tk04e: 'L\'utiliser en carte enregistrée',
    tk05: 'TK-05 Fil rouge : la carte volée suspend le jeton, mise à jour du PAN sur la nouvelle carte', tk05a: 'Ajouter la carte au téléphone', tk05b: 'Opposition pour vol', tk05c: 'Payer avec le téléphone', tk05d: 'Réactiver sans nouvelle carte', tk05e: 'Réactiver sur la carte de remplacement',
    tk06: 'TK-06 Cycle de vie : la suppression est définitive', tk06a: 'Réactiver un jeton actif', tk06b: 'Suspendre (téléphone perdu)', tk06c: 'Supprimer', tk06d: 'Réactiver un jeton supprimé',
    pl01: 'PL-01 Annuler avant remise est une annulation, pas un remboursement', pl01a: 'Rembourser avant remise', pl01b: 'Annuler', pl01c: 'Remettre après annulation',
    pl02: 'PL-02 Après remise, annuler devient rembourser', pl02a: 'Annuler un paiement remis', pl02b: 'Rembourser 40 €', pl02c: 'Rembourser plus que le reste',
    pl03: 'PL-03 Marchandise non reçue : le commerçant gagne avec la preuve de livraison', pl03a: 'Émettre un impayé 13.1', pl03b: 'Représenter avec la preuve de livraison', pl03c: 'Rembourser après clôture',
    pl04: 'PL-04 Fraude sur carte volée : la responsabilité dépend de 3-D Secure', pl04a: '10.4 sur un paiement 3DS', pl04b: '10.4 sans déclaration de fraude', pl04c: '10.4 avec la déclaration',
    pl05: 'PL-05 Délai de réponse dépassé : le commerçant perd', pl05a: 'Émettre un impayé 13.1', pl05b: 'Avancer l\'horloge de 31 jours', pl05c: 'Représenter trop tard',
    pl06: 'PL-06 Preuve faible : pré-arbitrage puis arbitrage avec frais', pl06a: 'Émettre un impayé 13.1', pl06b: 'Représenter avec un simple suivi', pl06c: 'Refuser le pré-arbitrage',
  },
};

const authBody = (pan, expiry, amount, channel = 'pos', extra = {}) => ({ pan, expiry, amount_minor: amount, currency: 'EUR', channel, ...extra });

export function demoCase(lang) {
  const b = BANK[lang], n = N[lang];
  return kase('case_demo', n.demo, [
    R(n.demo1, 'POST', `/cards/${b.spare}/block`, { reason: 'lost', channel: 'app', declared_by: 'cardholder' },
      [st(200), j('$.status', 'eq', 'blocked'), j('$.block.exception_file', 'eq', 'listed'), j('$.wallet_tokens[*].status', 'eq', 'suspended')]),
    R(n.demo2, 'POST', '/authorisations', authBody(b.panS, b.expS, 1250, 'pos', { entry_mode: 'CONTACTLESS', merchant_id: 'M-001' }),
      [st(200), j('$.response_code', 'eq', '41'), j('$.approved', 'eq', 'false'), ck('time', '', 'lt', 500)]),
    R(n.demo3, 'POST', `/cards/${b.spare}/unblock`, null, [st(422), j('$.rule', 'eq', 'U3')]),
  ]);
}

export function suiteCases(lang) {
  const b = BANK[lang], n = N[lang];
  const tc05 = lang === 'en'
    ? [R(n.tc05a, 'POST', '/authorisations', authBody('4000000000001075', '2029-03', 4500), [st(200), j('$.response_code', 'eq', '00'), j('$.stip', 'eq', 'true')]),
      R(n.tc05b, 'POST', '/authorisations', authBody('4000000000001075', '2029-03', 25000), [st(200), j('$.response_code', 'eq', '05'), j('$.stip', 'eq', 'true')])]
    : [R(n.tc05a, 'POST', '/authorisations', authBody('4000000000002032', '2029-06', 4500), [st(200), j('$.response_code', 'eq', '91'), j('$.stip', 'eq', 'false'), j('$.approved', 'eq', 'false')])];
  return [
    demoCase(lang),
    kase('tc01', n.tc01, [R(n.tc01, 'GET', `/cards/${b.c1}`, null, [st(401), j('$.type', 'ends', 'unauthorized')], [], noAuth)]),
    kase('tc02', n.tc02, [R(n.tc02, 'GET', `/cards/${b.c1}`, null, [st(200), j('$.status', 'eq', 'active'), j('$.pan_masked', 'eq', b.pan1.slice(0, 6) + '******' + b.pan1.slice(-4)), j('$.pan', 'not_exists'), ck('time', '', 'lt', 500)])]),
    kase('tc03', n.tc03, [R(n.tc03, 'POST', '/authorisations', authBody(b.pan1, b.exp1, 4250, 'pos', { entry_mode: 'CONTACTLESS' }),
      [st(200), j('$.response_code', 'eq', '00'), j('$.approved', 'eq', 'true'), j('$.stip', 'eq', 'false'), j('$.auth_code', 'matches', '^[A-Z0-9]{6}$')])]),
    kase('tc04', n.tc04, [R(n.tc04, 'POST', '/authorisations', { pan: '{{pan}}', expiry: '{{expiry}}', amount_minor: 8000, currency: 'EUR', channel: '{{channel}}' },
      [st(200), j('$.response_code', 'eq', '{{expect}}'), j('$.approved', 'eq', 'false'), j('$.auth_code', 'eq', 'null')])],
    { data: b.declines.map(([pan, expiry, channel, expect]) => ({ pan, expiry, channel, expect })) }),
    kase('tc05', n.tc05, tc05),
    kase('tc06', n.tc06, [
      R(n.tc06a, 'POST', `/cards/${b.spare}/block`, { reason: 'stolen', channel: 'app', declared_by: 'cardholder' },
        [st(200), j('$.status', 'eq', 'blocked'), j('$.block.exception_file', 'eq', 'listed'), j('$.wallet_tokens[*].status', 'eq', 'suspended'), j('$.replacement.ordered', 'eq', 'true')]),
      R(n.tc06b, 'POST', '/authorisations', authBody(b.panS, b.expS, 1000), [j('$.response_code', 'eq', '43')]),
      R(n.tc06c, 'POST', `/cards/${b.spare}/block`, { reason: 'lost', channel: 'app' }, [st(409), j('$.rule', 'eq', 'B2')])]),
    kase('tc07', n.tc07, [
      R(n.tc07a, 'POST', `/cards/${b.c5}/unblock`, null, [st(422), j('$.type', 'ends', 'unblock-not-allowed')]),
      R(n.tc07b, 'POST', `/cards/${b.spare}/block`, { reason: 'lost', channel: 'app' }, [st(200)]),
      R(n.tc07c, 'POST', `/cards/${b.spare}/unblock`, null, [st(200), j('$.status', 'eq', 'active'), j('$.block', 'eq', 'null')])]),
    kase('tc08', n.tc08, [
      R(n.tc08a, 'POST', '/fraud-reports', { transaction_id: b.tx.report, card_id: b.c5, fraud_type: '6', case_id: 'CASE-2026-0412' }, [st(201), j('$.status', 'eq', 'sent'), j('$.fraud_report_id', 'matches', '^FR-')]),
      R(n.tc08b, 'POST', '/fraud-reports', { transaction_id: b.tx.report, card_id: b.c5, fraud_type: '6', case_id: 'CASE-2026-0412' }, [st(409)]),
      R(n.tc08c, 'POST', '/fraud-reports', { transaction_id: b.tx.declined, card_id: b.tx.declinedCard, fraud_type: '6', case_id: 'CASE-2026-0413' }, [st(422), j('$.rule', 'eq', 'F3')])]),
    kase('tc09', n.tc09, [
      R(n.tc09a, 'POST', '/disputes', { transaction_id: b.tx.report, condition_code: '10.4', amount_minor: 12990, currency: 'EUR' }, [st(422), j('$.type', 'ends', 'fraud-report-required')]),
      R(n.tc09b, 'POST', '/disputes', { transaction_id: b.tx.open, condition_code: '10.4', amount_minor: 8990, currency: 'EUR', fraud_report_id: b.tx.openReport }, [st(409), j('$.type', 'ends', 'dispute-already-open')])]),
    kase('tc10', n.tc10, [
      R(n.tc10a, 'POST', '/disputes', { transaction_id: b.tx.day120, condition_code: '13.1', amount_minor: 5400, currency: 'EUR' }, [st(201), j('$.status', 'eq', 'submitted'), ck('header', 'Location', 'starts', '/disputes/')]),
      R(n.tc10b, 'POST', '/disputes', { transaction_id: b.tx.day121, condition_code: '13.1', amount_minor: 3200, currency: 'EUR' }, [st(422), j('$.rule', 'eq', 'D2')])]),
  ];
}

export function lifecycleCases(lang) {
  const b = BANK[lang], n = N[lang], p = b.pay;
  const TRID = '40010030273';
  const prov = (name, pan, exp, device, risk, age, checks, extra = {}) => R(name, 'POST', '/tokens', { pan, expiry: exp, wallet: 'apple_pay', token_requestor_id: TRID, device_id: device, device_type: 'phone', device_risk: risk, wallet_account_age_days: age, ...extra }, checks, [{ var: 'token_ref', path: '$.token_ref' }]);
  const disp = { var: 'dispute_id', path: '$.dispute_id' };
  return [
    kase('tk01', n.tk01, [prov(n.tk01, b.pan1, b.exp1, 'dev_iphone_demo_01', 'low', 400, [st(201), j('$.decision', 'eq', 'green'), j('$.status', 'eq', 'active'), j('$.token_masked', 'starts', '400099'), j('$.pan', 'not_exists'), j('$.par', 'matches', '^[A-Z0-9]{29}$'), j('$.demo_only', 'eq', 'true')])]),
    kase('tk02', n.tk02, [
      prov(n.tk02a, b.panS, b.expS, 'dev_iphone_demo_02', 'medium', 3, [j('$.decision', 'eq', 'yellow'), j('$.status', 'eq', 'pending_idv')]),
      R(n.tk02b, 'POST', '/tokens/{{token_ref}}/idv', { method: 'sms_otp', otp: '000000' }, [st(422), j('$.rule', 'eq', 'T9')]),
      R(n.tk02c, 'POST', '/tokens/{{token_ref}}/idv', { method: 'sms_otp', otp: '123456' }, [st(200), j('$.status', 'eq', 'active')])]),
    kase('tk03', n.tk03, [R(n.tk03, 'POST', '/tokens', { pan: '{{pan}}', expiry: '{{expiry}}', wallet: 'apple_pay', token_requestor_id: TRID, device_id: 'dev_x', device_risk: 'low' },
      [st(201), j('$.decision', 'eq', 'red'), j('$.token_ref', 'eq', 'null'), j('$.decision_reason', 'eq', '{{expect_reason}}')])], { data: b.red.map(([pan, expiry, expect_reason]) => ({ pan, expiry, expect_reason })) }),
    kase('tk04', n.tk04, [
      prov(n.tk04a, b.pan1, b.exp1, 'dev_iphone_demo_01', 'low', 400, [st(201)]),
      R(n.tk04b, 'POST', '/tokens/{{token_ref}}/cryptogram', { amount_minor: 4250, currency: 'EUR', channel: 'in_app' }, [st(200), j('$.cryptogram', 'starts', 'FAKE'), j('$.demo_only', 'eq', 'true')], [{ var: 'cryptogram', path: '$.cryptogram' }]),
      R(n.tk04c, 'POST', '/payments', { payment_token: { token_ref: '{{token_ref}}', cryptogram: '{{cryptogram}}' }, amount_minor: 4250, currency: 'EUR', channel: 'in_app' }, [st(201), j('$.response_code', 'eq', '00'), j('$.wallet', 'eq', 'true')]),
      R(n.tk04d, 'POST', '/payments', { payment_token: { token_ref: '{{token_ref}}', cryptogram: '{{cryptogram}}' }, amount_minor: 4250, currency: 'EUR', channel: 'in_app' }, [st(422), j('$.rule', 'eq', 'T18')]),
      R(n.tk04e, 'POST', '/tokens/{{token_ref}}/cryptogram', { amount_minor: 1000, currency: 'EUR', channel: 'card_on_file' }, [st(422), j('$.rule', 'eq', 'T17')])]),
    kase('tk05', n.tk05, [
      prov(n.tk05a, b.panS, b.expS, 'dev_iphone_demo_03', 'low', 500, [j('$.status', 'eq', 'active')]),
      R(n.tk05b, 'POST', `/cards/${b.spare}/block`, { reason: 'stolen', channel: 'app' }, [st(200), j('$.wallet_tokens[*].status', 'eq', 'suspended')]),
      R(n.tk05c, 'POST', '/tokens/{{token_ref}}/cryptogram', { amount_minor: 1000, currency: 'EUR', channel: 'contactless' }, [st(422), j('$.rule', 'eq', 'T16')]),
      R(n.tk05d, 'POST', '/tokens/{{token_ref}}/resume', { reason: 'card_blocked_stolen' }, [st(422), j('$.rule', 'eq', 'T13')]),
      R(n.tk05e, 'POST', '/tokens/{{token_ref}}/resume', { reason: 'card_replaced', requested_by: 'issuer', new_card_id: `${b.spare}_r1` }, [st(200), j('$.status', 'eq', 'active'), j('$.card_id', 'eq', `${b.spare}_r1`)])]),
    kase('tk06', n.tk06, [
      prov(n.tk01, b.pan1, b.exp1, 'dev_iphone_demo_01', 'low', 400, [st(201)]),
      R(n.tk06a, 'POST', '/tokens/{{token_ref}}/resume', { reason: 'cardholder_request' }, [st(409), j('$.rule', 'eq', 'T12')]),
      R(n.tk06b, 'POST', '/tokens/{{token_ref}}/suspend', { reason: 'device_lost', requested_by: 'cardholder' }, [st(200), j('$.status', 'eq', 'suspended')]),
      R(n.tk06c, 'POST', '/tokens/{{token_ref}}/delete', { reason: 'cardholder_request' }, [st(200), j('$.status', 'eq', 'deleted')]),
      R(n.tk06d, 'POST', '/tokens/{{token_ref}}/resume', { reason: 'device_found' }, [st(409), j('$.type', 'ends', 'token-deleted')])]),
    kase('pl01', n.pl01, [
      R(n.pl01a, 'POST', `/payments/${p.hotel}/refunds`, { amount_minor: p.hotelAmt, reason: 'service_cancelled' }, [st(409), j('$.rule', 'eq', 'R1')]),
      R(n.pl01b, 'POST', `/payments/${p.hotel}/reversal`, { reason: 'customer_cancelled' }, [st(200), j('$.status', 'eq', 'reversed'), j('$.reversed_minor', 'eq', p.hotelAmt)]),
      R(n.pl01c, 'POST', `/payments/${p.hotel}/capture`, null, [st(409), j('$.rule', 'eq', 'P3')])]),
    kase('pl02', n.pl02, [
      R(n.pl02a, 'POST', `/payments/${p.shoes}/reversal`, null, [st(409), j('$.rule', 'eq', 'P6'), j('$.detail', 'contains', 'refunds')]),
      R(n.pl02b, 'POST', `/payments/${p.shoes}/refunds`, { amount_minor: 4000, reason: 'goods_returned' }, [st(201), j('$.status', 'eq', 'partially_refunded'), j('$.refunded_minor', 'eq', 4000)]),
      R(n.pl02c, 'POST', `/payments/${p.shoes}/refunds`, { amount_minor: p.shoesAmt - 4000 + 1 }, [st(422), j('$.rule', 'eq', 'R2')])]),
    kase('pl03', n.pl03, [
      R(n.pl03a, 'POST', `/payments/${p.atlas}/disputes`, { condition_code: '13.1', amount_minor: 8900, expected_delivery_date: '2026-10-20' }, [st(201), j('$.workflow', 'eq', 'collaboration'), j('$.status', 'eq', 'chargeback'), j('$.respond_by', 'eq', '2026-12-08')], [disp]),
      R(n.pl03b, 'POST', '/disputes/{{dispute_id}}/representment', { evidence: ['proof_of_delivery', 'signed_delivery'] }, [st(200), j('$.status', 'eq', 'won'), j('$.liability', 'eq', 'issuer')]),
      R(n.pl03c, 'POST', `/payments/${p.atlas}/refunds`, { amount_minor: 100 }, [st(201)])]),
    kase('pl04', n.pl04, [
      R(n.pl04a, 'POST', `/payments/${p.fraud3ds}/disputes`, { condition_code: '10.4', amount_minor: p.fraud3dsAmt, fraud_report_id: p.report }, [st(422), j('$.rule', 'eq', 'D9')]),
      R(n.pl04b, 'POST', `/payments/${p.fraudNo3ds}/disputes`, { condition_code: '10.4', amount_minor: p.fraudNo3dsAmt }, [st(422), j('$.type', 'ends', 'fraud-report-required')]),
      R(n.pl04c, 'POST', `/payments/${p.fraudNo3ds}/disputes`, { condition_code: '10.4', amount_minor: p.fraudNo3dsAmt, fraud_report_id: p.report }, [st(201), j('$.workflow', 'eq', 'allocation'), j('$.liability', 'eq', 'merchant')])]),
    kase('pl05', n.pl05, [
      R(n.pl05a, 'POST', `/payments/${p.atlas}/disputes`, { condition_code: '13.1', amount_minor: 8900, expected_delivery_date: '2026-10-20' }, [st(201)], [disp]),
      R(n.pl05b, 'POST', '/_mock/clock', { advance_days: 31 }, [j('$.today', 'eq', '2026-12-09')]),
      R(n.pl05c, 'POST', '/disputes/{{dispute_id}}/representment', { evidence: ['proof_of_delivery'] }, [st(422), j('$.rule', 'eq', 'D12')])]),
    kase('pl06', n.pl06, [
      R(n.pl06a, 'POST', `/payments/${p.atlas}/disputes`, { condition_code: '13.1', amount_minor: 8900, expected_delivery_date: '2026-10-20' }, [st(201)], [disp]),
      R(n.pl06b, 'POST', '/disputes/{{dispute_id}}/representment', { evidence: ['tracking_only'] }, [j('$.status', 'eq', 'pre_arbitration')]),
      R(n.pl06c, 'POST', '/disputes/{{dispute_id}}/pre-arbitration', { accept: false }, [j('$.status', 'eq', 'lost'), j('$.ledger[-1].debit', 'eq', 'merchant'), j('$.fee_minor', 'exists')])]),
  ];
}

export function httpbinCase(lang) {
  const b = BANK[lang];
  const req = R(N[lang].http, 'POST', 'https://httpbin.org/anything?source=analyst-kit', { pan_masked: b.pan1.slice(0, 6) + '******' + b.pan1.slice(-4), amount_minor: 4250, currency: 'EUR', merchant: lang === 'fr' ? 'Boulangerie Lumière (démo)' : 'Bay Coffee (demo)' },
    [st(200), j('$.json.amount_minor', 'eq', 4250), j('$.args.source', 'eq', 'analyst-kit'), ck('time', '', 'lt', 3000)], [], noAuth);
  return { id: 'case_httpbin', name: N[lang].http, reset: false, steps: [step(req)] };
}

export const envFor = (lang) => ({ name: lang === 'fr' ? 'Démo · Banque Lumière (simulée)' : 'Demo · Harbor Bank (mock)',
  vars: [{ key: 'base_url', value: BASES[BANK[lang].brand], secret: false, on: true }, { key: 'api_key', value: KEYS[BANK[lang].brand], secret: false, on: true }] });

const clone = (o) => JSON.parse(JSON.stringify(o));
function sampleState(lang, cases, pick, extra = {}) {
  const c = cases.find((x) => x.id === pick.caseId) || cases[0];
  return { req: clone(c.steps[pick.step || 0].req), env: envFor(lang), cases: clone(cases), editing: { caseId: c.id, step: pick.step || 0 },
    touched: true, tab: 'body', side: 'cases', vars: {}, history: [], ...extra };
}
const S = (lang) => {
  const fr = lang === 'fr';
  const all = suiteCases(lang);
  return [
    { id: 'demo60', label: fr ? 'Démo 60 s · opposition puis paiement refusé (41)' : '60-second demo · block a lost card, then pay (41)',
      hint: fr ? 'Envoyer, puis l\'étape 2 et l\'étape 3 · ou « Lancer le cas »' : 'Send, then step 2 and step 3 · or "Run case"', autorun: true,
      state: sampleState(lang, [demoCase(lang)], { caseId: 'case_demo', step: 0 }, { guide: true }) },
    { id: 'suite', label: fr ? 'Banque Lumière · 10 cas de test prêts' : 'Harbor Bank · 10 ready-made test cases',
      hint: fr ? '« Tout lancer » donne le rapport de recette' : '"Run all" gives the UAT evidence report',
      state: sampleState(lang, all, { caseId: 'tc03', step: 0 }) },
    { id: 'lifecycle', label: fr ? 'Jetons et impayés · 12 cas (TK, PL)' : 'Tokens and chargebacks · 12 cases (TK, PL)',
      hint: fr ? 'Apple Pay, annulation, remboursement, impayé' : 'Apple Pay, reversal, refund, chargeback',
      state: sampleState(lang, lifecycleCases(lang), { caseId: 'tk01', step: 0 }) },
    { id: 'httpbin', label: fr ? 'Vrai appel Internet · httpbin.org' : 'Real internet call · httpbin.org', autorun: true,
      hint: fr ? 'La requête quitte vraiment le navigateur' : 'The request really leaves the browser',
      state: sampleState(lang, [httpbinCase(lang)], { caseId: 'case_httpbin', step: 0 }) },
  ];
};
export const SAMPLES = { en: S('en'), fr: S('fr') };
export const TEST_CARD_TABLE = BANK;

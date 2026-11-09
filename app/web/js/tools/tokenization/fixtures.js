/* Test fixtures shared by the Tokenization and Payment lifecycle simulators (owner K).
   Cards are read from builder C's app/web/js/mock/fixtures.js (one source of truth, Luhn-corrected PANs per
   research/09 decision 12; the old YAML PANs are still accepted through legacy_pans). Fictional data only. */

import MOCK from '../../mock/fixtures.js';

export const MOCK_TODAY = MOCK.today || '2026-11-08';

const HOLDERS = ['A. Martin', 'B. Okafor', 'C. Novak', 'D. Silva', 'E. Lindqvist', 'F. Haddad', 'G. Rossi', 'H. Tanaka', 'I. Dubois'];
const fromMock = (brand, bank, network) => ((MOCK.brands && MOCK.brands[brand] && MOCK.brands[brand].cards) || []).map((c, i) => ({
  card_id: c.card_id, bank, pan: c.pan, expiry: c.expiry, status: c.status, network, holder: HOLDERS[i % HOLDERS.length],
  ...(c.block ? { block_reason: c.block.reason } : {}), ...(c.fraud_watch ? { fraud_watch: true } : {}), product: c.product,
}));
/** Cards come from builder C's shared mock fixtures (Luhn-corrected PANs), plus one local Mastercard test card. */
export const CARDS = [
  ...fromMock('harbor', 'hb', 'visa'),
  // Local addition (not in C's mock): the public Mastercard test number, so the simulator can show MDES.
  { card_id: 'crd_hb_009', bank: 'hb', pan: '5555555555554444', expiry: '2029-08', status: 'active', network: 'mastercard', holder: 'I. Dubois', local: true },
  ...fromMock('lumiere', 'bl', 'cb'),
];
export const LEGACY_PANS = MOCK.legacy_pans || {};

export const TOKEN_REQUESTORS = [
  { trid: '40010030273', name: 'Apple Pay (demo TRID)', wallet: 'apple_pay', type: 'wallet', device_bound: true },
  { trid: '40010075001', name: 'Google Pay (demo TRID)', wallet: 'google_pay', type: 'wallet', device_bound: true },
  { trid: '40010099001', name: 'QuickGift Codes card-on-file (demo)', wallet: 'merchant_card_on_file', type: 'merchant', device_bound: false },
];

/** Fictional 400099 range, Luhn-valid, never routable; assigned in order (YAML token_numbers). */
export const TOKEN_NUMBERS = ['4000990000000012', '4000990000000020', '4000990000000038', '4000990000000046', '4000990000000053', '4000990000000061', '4000990000000079', '4000990000000087'];

export const MERCHANTS = [
  { id: 'M-001', name: 'Corner Café (demo)' },
  { id: 'M-002', name: 'Harbour Hotel (demo)' },
  { id: 'M-004', name: 'Northwind Shoes (demo)' },
  { id: 'M-007', name: 'Atlas Home (demo)' },
  { id: 'M-011', name: 'QuickGift Codes (demo)' },
  { id: 'M-F01', name: 'Boulangerie du Port (démo)' },
  { id: 'M-F02', name: 'Boutique Lumière (démo)' },
  { id: 'M-F03', name: 'Maison en ligne (démo)' },
];

export function luhnValid(num) {
  const d = String(num).replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
export function luhnComplete(prefix) {
  for (let c = 0; c < 10; c++) if (luhnValid(prefix + c)) return prefix + c;
  return prefix + '0';
}

export const maskPan = (pan) => (pan ? `${pan.slice(0, 6)}******${pan.slice(-4)}` : '');
export const last4 = (pan) => (pan ? `•••• ${pan.slice(-4)}` : '');
export const findCard = (id) => CARDS.find((c) => c.card_id === id);
export const findCardByPan = (pan) => { const p = String(pan).replace(/\s/g, ''); return CARDS.find((c) => c.pan === p || c.pan === LEGACY_PANS[p]); };

/** Replacement card for a blocked card: same holder, new Luhn-valid test PAN, expiry + 3 years. */
export function replacementOf(card) {
  const n = String(CARDS.indexOf(card) + 1).padStart(2, '0');
  const prefix = card.network === 'mastercard' ? '555555555555590' : `4000000000009${n}`.slice(0, 15);
  const pan = luhnComplete(prefix.slice(0, 15));
  const [y, m] = card.expiry.split('-');
  return { ...card, card_id: `${card.card_id}_r1`, pan, expiry: `${+y + 3}-${m}`, status: 'ordered', block_reason: undefined, fraud_watch: false, replaces: card.card_id, local: true };
}

/** Network → token service provider (TSP). CB tokenisation details are *to confirm* (research/09 §1). */
export const TSP = { visa: 'VTS', mastercard: 'MDES', cb: 'CB' };

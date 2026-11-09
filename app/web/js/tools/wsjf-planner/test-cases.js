/* Test cases for the wsjf.py parity check (test.html, logic.test.mjs). Expected outputs live in fixtures.js,
   produced by running skills/managing-backlog/scripts/wsjf.py on featuresCsv(case.items). */
import { SAMPLES } from './samples.js';

const en = SAMPLES.en[0].state;
const fr = SAMPLES.fr[0].state;
const it = (id, bv, tc, rr, size, points, deps = '', deadline = '') => ({
  id, title: `Item ${id}`, type: 'Story', business_value: bv, time_criticality: tc, risk_reduction: rr, job_size: size, points, depends_on: deps, deadline,
});

export const CASES = [
  { id: 'en-120', label: 'Harbor Bank sample, capacity 120', items: en.items, capacity: 120, project: 'CARD' },
  { id: 'fr-120', label: 'Banque Lumière sample, capacity 120', items: fr.items, capacity: 120, project: 'CARTE' },
  { id: 'en-60', label: 'Harbor Bank sample, capacity 60 (dependencies pulled in)', items: en.items, capacity: 60, project: 'CARD' },
  { id: 'en-200', label: 'Harbor Bank sample, capacity 200', items: en.items, capacity: 200, project: 'CARD' },
  { id: 'en-f04-size8', label: 'F-04 job size 13 → 8 (order flips with F-08)', items: en.items.map((x) => (x.id === 'F-04' ? { ...x, job_size: 8 } : x)), capacity: 120, project: 'CARD' },
  { id: 'ties', label: 'Half-even rounding and tie-breaks (5/8, 3/8, deadline, size)', capacity: 30, project: 'T',
    items: [it('A', 1, 2, 2, 8, 5), it('B', 1, 1, 1, 8, 5, '', 'in-pi'), it('C', 2, 2, 1, 8, 5), it('D', 3, 3, 3, 13, 5), it('E', 1, 1, 1, 8, 5), it('F', 2, 2, 2, 2, 25, 'A;C')] },
  { id: 'cycle', label: 'Circular dependency', capacity: 50, project: 'C',
    items: [it('X', 8, 8, 8, 3, 10, 'Y'), it('Y', 5, 5, 5, 3, 10, 'X'), it('Z', 3, 3, 3, 5, 10, '', 'in-pi')] },
  { id: 'quotes', label: 'Title with comma and quotes, empty points', capacity: 10, project: 'Q',
    items: [{ ...it('Q-1', 5, 5, 5, 5, 0), title: 'Block, then "list" the PAN' }, { ...it('Q-2', 3, 3, 3, 3, 8), type: '' }] },
];

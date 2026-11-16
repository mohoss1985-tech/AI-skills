import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, emptyState, splitByRule, stubExamples, storyLine, toFeature, toJiraCsv, toMarkdown, wantText, newExample } from './logic.js';

const T = (k) => k;
const base = () => ({ ...emptyState('en'), feature: 'Dispute a card payment in the app', persona: 'cardholder', rulesText: '- A fraud dispute needs the card to be blocked first\n3 documents max per dispute\n2) Refund within 5 days' });

test('want gets "to": verb phrase fixed, noun phrase and existing "to" untouched', () => {
  assert.equal(wantText('Dispute a card payment in the app'), 'to dispute a card payment in the app');
  assert.equal(wantText('to block my card'), 'to block my card');
  assert.equal(wantText('a receipt by email'), 'a receipt by email');
  assert.equal(wantText('Contester un paiement', 'fr'), 'contester un paiement');
  const s = buildMap(base());
  assert.equal(storyLine(s.stories[0], 'cardholder', 'en'), 'As a cardholder, I want to dispute a card payment in the app.');
  assert.match(storyLine({ want: 'dispute a payment', soThat: '' }, 'cardholder', 'en'), /I want to dispute a payment\./);
});

test('leading digits in rules are kept, list markers are stripped', () => {
  const s = buildMap(base());
  assert.deepEqual(s.stories[0].rules.map((r) => r.text), ['A fraud dispute needs the card to be blocked first', '3 documents max per dispute', 'Refund within 5 days']);
});

test('split by rule keeps the parent want, rule goes in the title', () => {
  const s = splitByRule(buildMap(base()), 'S1');
  assert.equal(s.stories.length, 3);
  assert.equal(s.stories[1].want, s.stories[0].want);
  assert.equal(s.stories[1].title, '3 documents max per dispute');
  assert.ok(!/documents max/.test(storyLine(s.stories[1], 'cardholder', 'en')));
});

test('keywords typed in step boxes are not doubled', () => {
  const s = buildMap(base());
  const r = s.stories[0].rules[0];
  r.examples.push({ ...newExample('E1', 'happy', 'ok'), given: 'Given Sam has a card', when: 'when Sam disputes', then: 'Then a case is opened\nAnd Sam gets an SMS' });
  const f = toFeature(s);
  assert.ok(!/Given Given|When When|Then Then|And And/.test(f));
  assert.match(f, /Given Sam has a card/);
  assert.match(f, /And Sam gets an SMS/);
});

test('Jira CSV: Work item ID, Epic row first, stories reference it in Parent, all labels kept', () => {
  const s = buildMap({ ...base(), epic: 'PAN declaration', labels: 'cards disputes extra' });
  const rows = toJiraCsv(s, T).replace(/^﻿/, '').split('\r\n').map((l) => l.split(','));
  const head = rows[0];
  assert.equal(head[0], 'Work item ID'); assert.equal(head[1], 'Work type'); assert.equal(head.at(-1), 'Parent');
  assert.equal(head.filter((h) => h === 'Labels').length, 3);
  assert.equal(rows[1][0], '1'); assert.equal(rows[1][1], 'Epic'); assert.equal(rows[1][2], 'PAN declaration');
  assert.equal(rows[2][1], 'Story'); assert.equal(rows[2][0], '2'); assert.equal(rows[2].at(-1), '1');
  assert.ok(rows[2].includes('extra'));
});

test('Jira CSV without epic: no Epic row, empty Parent', () => {
  const csv = toJiraCsv(buildMap(base()), T).replace(/^﻿/, '');
  assert.ok(!/,Epic,/.test(csv));
  assert.match(csv.split('\r\n')[1], /^1,Story,/);
});

test('example stubs are never exported as scenarios until completed', () => {
  const s = stubExamples(buildMap(base()), 'S1', (k) => k);
  assert.ok(!/Scenario:/.test(toFeature(s)));
  assert.ok(!/Scenario:/.test(toJiraCsv(s, T)));
  assert.ok(!/stub\.happy/.test(toMarkdown(s, T)));
  s.stories[0].rules[0].examples[0].when = 'Sam disputes'; s.stories[0].rules[0].examples[0].then = 'a case opens';
  assert.match(toFeature(s), /Scenario:/);
});

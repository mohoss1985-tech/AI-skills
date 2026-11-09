/* node app/web/js/tools/workshop-kit/logic.test.mjs [--write-json] */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { parseAttendees, checks, fitToDuration, totalMinutes, maxTopics, timerStart, timerPause, timerNext, elapsed, parseNote, addNote, actionsCsv, agendaFromCsv } from './logic.js';
import { SAMPLES } from './samples.js';

const p = parseAttendees('Ana (Head of cards, sponsor), Tom (Card IT; host), Legal (absent)');
assert.equal(p.length, 3); assert.equal(p[0].dm, true); assert.equal(p[1].role, 'Card IT; host'); assert.equal(p[2].absent, true);
assert.equal(maxTopics(90), 3); assert.equal(maxTopics(120), 4); assert.equal(maxTopics(60), 2);

const w1 = SAMPLES.en[0].state;
assert.equal(totalMinutes(w1.agenda), 120);
assert.deepEqual(checks(w1).map((c) => c.level), ['ok', 'ok', 'ok', 'ok', 'warn']); // A-04 has no date
const w2 = SAMPLES.en[1].state;
const c2 = Object.fromEntries(checks(w2).map((c) => [c.id, c.level]));
assert.equal(c2.duration, 'bad'); assert.equal(c2.topics, 'bad'); assert.equal(c2.readback, 'bad'); assert.equal(c2.dm, 'ok');
const fit = fitToDuration(w2.agenda, 60, 'Read back');
assert.equal(totalMinutes(fit), 60); assert.equal(fit[fit.length - 1].kind, 'readback'); assert.ok(fit.every((b) => b.minutes >= 5));
assert.equal(Object.fromEntries(checks({ ...w2, agenda: fit }).map((c) => [c.id, c.level])).duration, 'ok');
for (const d of [45, 90, 120, 180]) assert.equal(totalMinutes(fitToDuration(w1.agenda, d)), d, 'fit ' + d);

let t = timerStart({}, 1000); t = timerPause(t, 61000); assert.equal(elapsed(t, 99999), 60000);
t = timerStart(t, 100000); t = timerNext(t, w1.agenda, 130000); assert.equal(t.i, 1); assert.equal(t.spent.b1, 90000); assert.equal(t.startedAt, 130000);
t = timerNext(t, w1.agenda, 140000, -1); assert.equal(t.i, 0); assert.equal(elapsed(t, 140000), 90000);

assert.deepEqual(parseNote('A: Ask the processor @Tom 2026-11-20'), { type: 'A', text: 'Ask the processor', owner: 'Tom', due: '2026-11-20' });
assert.equal(parseNote('R: listing in real time').type, 'REQ');
assert.equal(addNote(w1.notes, { type: 'A', text: 'x' }, 'b1').at(-1).id, 'A-06');
assert.ok(actionsCsv(w1).startsWith('id,action,owner,due,block,workshop\r\nA-01,'));
assert.equal(agendaFromCsv('title,kind,minutes\nIntro,intro,10\n"Rules, examples",topic,30').length, 2);
console.log('workshop-kit logic: all checks pass');
if (process.argv.includes('--write-json')) writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 2) + '\n');

# Build R3 · Tokenization simulator rebuild (V3) — DONE

Owner files only: `app/web/js/tools/tokenization/*`, `skills/tokenizing-cards/SKILL.md`.

## What changed

| File | Change |
|---|---|
| `logic.js` | Each engine message carries its payload fields. New: `chapters()`, `stepMove()` (step engine), `suggestNext()`, `FIELD_NAMES` / `fieldName()`, op `renew` (card replaced with no block), `snaps`, `actions`, `tsp` in the result. |
| `guide-i18n.js` (new) | EN + FR: one plain caption per message (`cap.*`), payload field labels (`pf.*`), guided UI, lifecycle panel. Merged over `i18n.js` in `index.js`. |
| `index.js` | Mount auto-run removed. Guided view: story strip, Back / **Next step ▸** / Play all, ←/→ keys, caption + payload card, CSS-grid sequence diagram, inline code box, lifecycle panel. Mermaid is no longer drawn on screen (exports keep it). |
| `tool.css` | Old step rail / Mermaid styles replaced by the guided view styles (tokens only, reduced-motion respected). |
| `samples.js`, `samples.json` | Inputs only: `actions: []`, no `autorun`. EN 5 samples (Visa VTS / Apple Pay first), FR 4 (CB co-badged first). Fixture test cards only. |
| `logic.test.mjs` (new) | 10 tests, all pass. |
| `skills/tokenizing-cards/SKILL.md` | "How to demo it" block (guided steps, 3 paths, lifecycle), field-name caveat, renewal row in the lifecycle table. |

## Tasks

1. **Guided Next step mode** — after Run flow, one arrow per press across Wallet / Device → Token Requestor → Token
   Service (VTS / MDES / CB) → Issuer (a Merchant / acquirer lane appears only in payment steps). Each step shows a
   one-line caption and the fields of that message: masked PAN, encrypted PAN, DPAN, token reference, PAR,
   TAVV (ARQC for contactless), ATC, ECI, ID&V methods, eligibility, decision (`00` / `85` / `05` for VTS,
   `APPROVED` / `REQUIRE_ADDITIONAL_AUTHENTICATION` / `DECLINED` for MDES). Back / Next + ← / → (ignored while the
   focus is in a field, tab list or the split handle). Path badge (green / yellow / red) appears only when the decision
   message is on screen. Yellow path stops at an inline code box: wrong code → refusal shown, box comes back;
   `123456` → token active; 3 wrong codes → token deleted.
2. **Lifecycle panel** — state strip (Pending ID&V → Active → Suspended → Deleted, lit at the cursor), token card
   (DPAN, PAR, PAN behind it, payments) and five step buttons: Pay, Suspend, Resume, Card replaced, Delete. The
   suggested next one is highlighted; a disabled one says why. Each press is a new chapter stepped arrow by arrow.
   "Card replaced" = PAN update with the same token and PAR (uses the existing block → replacement flow when the card
   is blocked, the new `renew` op otherwise).
3. **Fits 1440×900** — measured in headless Edge at 1440×900: document scroll width 1440, diagram 548 px wide in a
   598 px results pane, no arrow or lane outside it, with 4 and with 5 lanes.
4. **Samples + tests** — see table. Regression tests cover the yellow-path Verify bug and the step engine.

## Audit bugs (audit-1.md §3)

| # | Bug | Status |
|---|---|---|
| 1 | Samples open finished; Verify code disabled on yellow | Fixed (samples are inputs only) + regression test |
| 2 | "Start empty" already provisioned | Fixed (no run in mount; one-line invitation) |
| 3 | Pill "Step N" contradicts the stepper | Fixed: pill = "Step n of total · chapter · path · status", updated on every step |
| 4 | Sequence diagram cut off | Fixed: CSS-grid diagram always as wide as the pane |
| 5 | Steps table misleading | Fixed: step named by the action (Replay cryptogram, PAN update…), one row per real call, expandable request body (PAN masked); card activation shows "No token API call" |
| 6 | MDES sample keeps Visa wording | Not reproduced: the Mastercard card resolves to MDES; test asserts no "VTS" in an MDES run. "(VTS)" on a Google Pay + Visa card is correct |
| 7 | Amount `42,5`; card list mixes banks | Amount fixed (text field, fixed 0.00 format). Card list: partial — every card stays selectable, each label now starts with the bank name (filtering would hide cards a user may want) |

Also fixed while there: the hidden "Does not see it" label of the "Who sees what" table made the whole page 160 px
wider than the viewport once that tab was visible.

## Tests and checks

- `cd app/web/js && node --test tools/tokenization/logic.test.mjs` → 10 pass, 0 fail.
- Headless Edge, 1440×900, static server: yellow (wrong code, right code, pay, suspend, resume, card replaced), green
  (5 × → key), red, FR sample. No exceptions, no console errors from the tool; the only log entries are the expected
  404 / 501 on `/api/*` of the plain static server (rule 9).
- Screenshot: `research/v3/shots/v3-tokenization.png` (saved, not inspected by eye — rule 3).

## Not checked / open issues

- The screen was verified by DOM measurements, not by looking at it. A visual pass by a person is still worth it,
  mostly for the diagram in the 598 px results pane (the split is 50 / 50 by default; lanes are about 110–135 px wide).
- UI in French was not run in the browser (the FR sample was run with the English UI). FR strings are covered by the
  key-coverage test only.
- The repaint after a remount (language switch, wallet change) is written but was not exercised in the browser.
- Scheme field names and ID&V method values (`OTPSMS`, `APP_TO_APP`, `CUSTOMERCARE`, MDES `activationMethods`) come
  from memory of the public VTS / MDES docs, no web fetch was made. They are labelled indicative on screen and in the
  skill. CB names are neutral placeholders.
- The token card in the lifecycle panel shows the latest values even when the presenter steps back to an earlier
  chapter (the state strip does follow the cursor).
- `renew` is allowed once per card in the demo (a second replacement would need a new test PAN rule).

## Needs from others

- Owner A (`tools/talking-points.js`): the third "How it works" bullet could now read "Next step ▸ shows one message
  at a time; then pay, suspend, replace the card". Optional.
- Shell: a wider default results pane for this tool (for example 35 / 65) would make the diagram easier to read from
  a distance. Optional.

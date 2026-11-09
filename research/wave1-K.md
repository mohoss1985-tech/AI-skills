# Wave 1 · K · Tokenization simulator + Payment lifecycle & chargeback simulator

Owner K, 2026-11-09. Port 4311. Files: `app/web/js/tools/tokenization/*`, `app/web/js/tools/payment-lifecycle/*`,
`skills/tokenizing-cards/SKILL.md`, `skills/handling-chargebacks/SKILL.md`. Built on A's tool frame (split layout,
`ctx.frame.*`, `ui.*`, `core/lazy.js loadMermaid`). Nothing committed.

## What I built

### Tokenization simulator (`#/tool/tokenization`, skill `tokenizing-cards`)
- **Command bar (4):** test card (masked PAN + id + expected green/red path) · wallet (Apple Pay / Google Pay / merchant card-on-file) · device · token requestor (TRID). Advanced · n set: other test PAN (shows T1), device risk, wallet account age, ID&V method, merchant.
- **Engine:** `logic.js` deterministic replay of `state.actions` from the fixtures. Rules T1–T18 + B3 (block suspends tokens) + B2. Same input always gives the same tokens, PAR and cryptograms (FNV hash, `FAKE` prefix, no key, no algorithm).
- **Steps you can take now:** ID&V code (demo `123456`; 3 wrong codes delete, T9) · Pay (new demo cryptogram, ATC++) · Replay last cryptogram (T18) · Phone lost: suspend · Resume · Delete · Card stolen / lost: block · Activate replacement card (PAN update, same PAR, T13) · Undo · Restart. Disabled buttons give the rule in their tooltip.
- **Results:** status pill (decision · status · token ref) · 7-step rail with the current step highlighted (red when refused) · current-step card with the last demo cryptogram and a "Demo value, not real cryptography" badge · tabs: **Sequence** (Mermaid via A's `loadMermaid`, current action in a highlighted `rect`, falls back to the source text) · **Who sees what** (6 actors × PAN / token / token ref / PAR / cryptogram, full / masked / last 4 / none) · **Token vault** · **Steps and API calls** (each step mapped to the mock call, for example `POST /tokens/TRF-HB-0001/cryptogram`).
- **Storyline sample:** pay, block the card as stolen, token suspended, next cryptogram refused (T16), resume refused (T13), activate the replacement, PAN update, pay again.
- **Samples:** EN 5 (green, yellow, red stolen card crd_hb_005, storyline crd_hb_008, Mastercard MDES card-on-file with replay + domain restriction T17). FR 4 (green CB, yellow Google Pay, red crd_bl_005, storyline crd_bl_008).
- **Exports:** Markdown (Save as deliverable: inputs, steps, Mermaid, vault, who-sees-what, open questions), JSON (vault + steps), CSV timeline, Mermaid `.mmd`, API test cases JSON. **AI:** Explain this step to a stakeholder · Write user stories for this flow · Draft the issuer decision rules.

### Payment lifecycle & chargeback simulator (`#/tool/payment-lifecycle`, skill `handling-chargebacks`)
- **Command bar (4):** amount · 3-D Secure (authenticated ECI 05 / attempted 06 / none 07) · event (void, reversal, partial capture, refund, chargeback) · reason (it follows the event: Visa condition 10.1–13.9 grouped with plain labels; in CB mode the label says the CB motif code is *to confirm*, and 10.4 shows motif 45 from Adyen). Advanced: scheme (Visa EN / CB FR), card, merchant, channel, wallet cryptogram, event amount, 4 dates, fraud report ID.
- **Engine:** `logic.js` replay with rules P3–P7, R1–R3, D1–D16 (D9 liability shift before D3; ECI 06 and wallet treated as shifted with a *to confirm* note), a mock clock, a ledger (debit and credit party per movement) and net positions. All deadlines and fees sit in **one `DEADLINES` table** `{scheme, step, days|months|business_days|amount, confidence, source_url}`.
- **Next steps:** clock +1 / +7 / +30 days · evidence checkboxes · Represent (or "Acquirer: file pre-arbitration" for Allocation) · Merchant accepts · Decline pre-arbitration → arbitration (adds the checked evidence as new) · Accept pre-arbitration · Capture / Reverse / Refund / Raise chargeback · Undo · Restart. Illegal steps are greyed and name the rule.
- **Results:** status pill · "Who carries the money now" + 4 net-position tiles · **FR: two tracks** (L133-18 refund due on the next business day, L133-24 13-month contest date, vs the interbank impayé with its motif and status) · tabs **Timeline** (authorisation → clearing → cancellation / refund / chargeback → representment → pre-arbitration → arbitration, with dates, Allocation / Collaboration badge, deadline countdown, *to confirm* badges, fee) · **Ledger** · **Steps and API calls** · **Deadlines and sources** · liability-shift box (fraud only, never 13.x).
- **Samples:** the 4 EN + 4 FR worked examples of research/09 (EN #4 = €219 3DS → D9 issuer pays; the hint says to switch 3DS to None to see the €349 charged back. FR #4 = 140 € 3DS on crd_bl_005, matching C's lumiere pay_0005).
- **Exports:** Markdown (payment, timeline, ledger, FR tracks, deadlines with sources, the dispute BPMN as a ```bpmn block, open questions), JSON, CSV timeline, CSV ledger, BPMN `.bpmn` (5 lanes, laid out), API test cases JSON. **AI:** Explain this step to a stakeholder · Draft the representment letter · Write user stories for this flow.

### Skills
`skills/tokenizing-cards/SKILL.md` and `skills/handling-chargebacks/SKILL.md`, in the outline of research/09 (actors table, green / yellow / red, lifecycle, cryptogram and domain; decision tree, classification, timeline and who pays, evidence, liability shift, France two tracks with L133-18 / L133-24, output contract, quality check, hand-offs). English, with the French CB terms.

## Public API (for other builders)
- `tools/tokenization/fixtures.js`: `CARDS` (**read from C's `mock/fixtures.js`**, so the PANs are the Luhn-corrected ones, …1018 / …2016 etc.; legacy YAML PANs are still accepted through `legacy_pans`) + local `crd_hb_009` Mastercard `5555555555554444`, `TOKEN_REQUESTORS`, `TOKEN_NUMBERS` (400099 range), `MERCHANTS`, `maskPan`, `luhnValid`, `replacementOf(card)`.
- `tools/tokenization/logic.js`: `simulate(input)` → `{log, messages, step, token, world, views, allowed, lastCryptogram}`, `toMermaid(res, tr, actorLabel)`, `apiCall(action, state, token)`.
- `tools/payment-lifecycle/logic.js`: `simulate(input)` → `{pay, dispute, log, ledger, positions, stages, allowed, liability, tracks, liabilityShift, today}`, `DEADLINES`, `CONDITIONS`, `WINNING_EVIDENCE`, `toBpmn(tr)`, `nextBusinessDay`.
- `tools/tokenization/tr.js`: `makeTr(ns, formatters)` turns logic messages `{k, p}` into text in the current language.
- `samples.json` in both folders (same content as `samples.js`) for B's static export.

## Switching to C's mock
C's `mock/bank.js` landed while I was building. My engines stay separate (they return richer data: sequence arrows, ledger, views), but they share C's fixtures. Parity was checked in Node on the storyline and PL cases against `getBank('harbor').handle(...)`. Same outcomes: token active → cryptogram 200 → block → T16 → T13 → PAN update 200; R1 then reversal; partial refund; D9 on pay_0005; Allocation chargeback on pay_0004; 13.1 Collaboration on pay_0002. To swap later, replace `simulate` with calls to `bank.handle(apiCall(...))` in one place per tool. **One difference:** C's resume with `new_card_id` succeeds without first activating the replacement; my simulator asks for "Activate replacement card" first (closer to T13's "active replacement").

## Verified
- Headless Edge over CDP, local server :4311: both tools, EN + FR samples, light + dark. **0 console errors, 0 exceptions, 0 failed requests** from my files. Click script: block → Pay disabled with T16 → activate replacement → active. Lifecycle: undo → represent with tracking only → pre-arbitration → +30 days → "0 days left". All 8 lifecycle samples and the token samples build Markdown, every export and every AI prompt without errors.
- Static export (`export_static.py`): both tools render and run with `KIT_DEMO` set (FR samples checked).
- Screenshots: `screenshots/v2/K-tokenization-{en,fr}-{light,dark}.png`, `K-tokenization-en-yellow-views.png`, `K-payment-lifecycle-{en,fr}-{light,dark}.png`, `K-payment-lifecycle-en-ledger.png`.

## Demo script (60 s each)
1. Tokenization → Load sample "Storyline" → the rail ends on Pay (approved); open **Steps and API calls**: block (B3), cryptogram refused (T16), resume refused (T13), PAN update, paid again. Open **Who sees what**: the merchant never has the PAN.
2. Payment lifecycle → "Not received (13.1)" → merchant wins. Undo, tick "Tracking only", Represent → pre-arbitration; +30 days → deadline 0 days; Decline → arbitration lost, fee *to confirm*. Then switch to CB FR → "Carte volée" → two tracks: L133-18 refund date vs impayé blocked by 3-D Secure.

## Open issues
- **Registry / sidebar:** A's registry already lists both ids. The top-bar crumb shows "Payment lifecycle & chargebacks" (A's short title).
- **A's strings:** "Save as deliverable", "Export", "Ask Claude", "Load sample" stay English in FR (A's i18n).
- The Mermaid sequence is wider than the results pane (scrolls sideways) and tall for long stories. A swimlane view of my own would fit better.
- YAML example PAR `Z999FAKEPAR0000000000000001` is 27 characters, not the 29 its own pattern demands. My PARs are 29.
- The lifecycle engine runs pre-arbitration → arbitration in one call, as in the YAML (D16). The CB pre-arbitration term, motifs (except 45), deadlines and fee stay *to confirm*. French public holidays are not handled in the J+1 business day.
- AI actions locally post to `/api/workspaces/:id/ai` (needs A's token fix in `core/api.js`, B's note).
- The `crd_hb_009` Mastercard card is local to K; C's mock doesn't know it (its API calls would be refused by T1).

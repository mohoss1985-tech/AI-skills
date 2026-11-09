# 09 · Tokenization simulator and payment lifecycle / chargeback simulator (owner K)

Companion file: `research/demo-api/tokens-and-disputes-openapi.yaml` (OpenAPI 3.1, 16 paths, fixtures, 12 test cases TK-01…06 / PL-01…06, CB twin). Parsed clean with Ruby Psych; every `$ref` resolves. It extends `harbor-bank-openapi.yaml` and reuses its keys, clock, reset and rules A1–A7, B1–B5, D1–D6.

Everything here comes from public sources. Where only a scheme rulebook can settle a point, the text says *to confirm*.

## Sources

**Tokenization**
- EMVCo Payment Tokenisation (Technical Framework v2.4, published 9 Jul 2026; TSP codes; PAR; BIN Controller IDs): https://www.emvco.com/emv-technologies/payment-tokenisation/ · quick reference guide: https://emvco.com/wp-content/uploads/2024/10/FINAL_TOKENISATION-QRG-1.pdf
- W3C note on how EMVCo, FIDO and W3C relate (token domain restriction controls): https://www.w3.org/TR/2020/NOTE-htr-20201105
- Apple Platform Security, adding cards (Required Fields / Check Card / Link and Provision; Device Account Number kept encrypted in the Secure Element, never on Apple servers or iCloud): https://support.apple.com/en-us/guide/security/sec0f005981a/web · payment authorisation (one-time cryptogram from a transaction counter and a key; Secure Enclave approval first): https://support.apple.com/guide/security-pdf/secc1f57e189/web
- Visa Token Service, provisioning and lifecycle (token requestor registration, suspend / resume / delete, PAN update): https://developer.visa.com/capabilities/token-service-provisioning · VTS fact sheet (PAR): https://www.visa.co.th/content/dam/VCOM/global/products/documents/visa-token-service-factsheet.pdf
- Mastercard MDES product page and lifecycle API: https://developer.mastercard.com/product/mdes · https://developer.mastercard.com/mdes-customer-service/documentation · token states: https://developer.mastercard.com/mdes-pre-digitization/documentation/api-basics/token_states_transition · green / yellow path and issuer ID&V for Apple Pay: https://developer.mastercard.com/mastercard-processing-digital/documentation/use-cases/enable-card-apple-pay-issuer-mobile-app/
- Green / yellow / red paths and early yellow-path fraud (2015): https://www.nfcw.com/2015/03/01/334364/apple-pay-provisioning-fraud-hole-has-to-get-plugged-now/ · https://www.techtarget.com/searchsecurity/news/2240241612/Amid-Apple-Pay-fraud-banks-scramble-to-fix-Yellow-Path-process
- CB on Apple Pay (press, end 2024 / 2025): https://iphonesoft.fr/2024/12/18/apple-pay-reseau-cb-iphone · https://www.igen.fr/services/2025/04/cic-apple-pay-disponible-pour-les-cartes-pro-et-sur-le-reseau-cb-149537 · CB tokenisation platform planned for 2026 (second-hand): https://banque.meilleurtaux.com/frais-bancaires/actualites/2024-novembre/tokenisation-vers-nouveau-paradigme-paiement-ligne.html

**Cancellation, refund, chargeback**
- Reversal vs refund, partial reversal, incremental authorisation (processor docs): https://increase.com/documentation/card-payment-lifecycle.md · https://docs.worldpay.com/access/products/card-payments/openapi/manage-payments · https://docs.silverflow.com/guides/charge-actions
- Visa Claims Resolution (Allocation = fraud and authorisation; Collaboration = processing errors and consumer disputes), defence windows (9 or 18 days at Adyen), pre-arbitration 30 days, arbitration filing fee USD 600 charged to the loser, 3DS: https://docs.adyen.com/risk-management/chargeback-guidelines/visa-chargebacks.md
- Visa dispute conditions and evidence per reason (Stripe): https://docs.stripe.com/disputes/reason-codes-defense-requirements · public Visa Rules (proprietary parts left out): https://www.visa.com/en-us/support/visa-rules.html · Visa merchant guide, 2015 copy (old, used only for vocabulary): https://www.belizebank.com/wp-content/uploads/2019/03/Chargeback-Management-Guidelines-for-Visa-Merchants.pdf
- Pre-arbitration and arbitration, no new evidence at arbitration: https://www.chargebackgurus.com/blog/a-guide-to-pre-arbitration-arbitration-for-chargeback-disputes
- 3-D Secure liability shift (ECI 05 / 06 / 07, exclusions, 10.4): https://docs.stripe.com/payments/electronic-commerce-indicator · https://developers.tabapay.com/docs/3d-secure-liability-shift
- Cartes Bancaires chargebacks at Adyen (reason 45 fraud cannot be defended; automatic defence if refunded or 3DS authenticated): https://docs.adyen.com/risk-management/chargeback-guidelines/cartes-bancaires-chargebacks
- CMF L133-18 (refund an unauthorised payment immediately, at the latest by the end of the next business day): https://www.doctrine.fr/l/texts/codes/LEGITEXT000006072026/articles/LEGIARTI000020861591 · the L133-18 to L133-24 regime in case law: https://www.actu-juridique.fr/affaires/bancaire-credit/le-droit-des-operations-non-autorisees-la-nouvelle-tendance-dominante-du-contentieux-bancaire/ · official text: https://www.legifrance.gouv.fr (check the current version there; the Légifrance article URL could not be fetched on 2026-11-08).

## Findings

### 1. Network tokenization in one page

**Actors** (EMVCo vocabulary):

| Actor | In the Apple Pay case | What it holds / sees |
|---|---|---|
| Cardholder | Adds the card in Wallet | Card details typed in or pushed from the issuer app |
| Token requestor (TRID) | Apple Pay; also Google Pay, or a merchant that stores cards on file | Token reference, last 4 of the PAN, card art. Apple can't read the Device Account Number |
| Token Service Provider (TSP) + token vault | Visa Token Service, Mastercard MDES, the CB service for CB-routed tokens | Token ↔ PAN mapping, domain restrictions, status, PAR. Checks cryptograms and detokenises |
| Issuer | Harbor Bank | Approves or declines provisioning (green / yellow / red), runs ID&V, sees the PAN, token reference, device and wallet |
| Device (Secure Element) | iPhone / Watch | Token ("Device Account Number", often called DPAN) and the cryptogram key. Each device gets its own token |
| Merchant / acquirer | Shop, PSP | Token, cryptogram, ECI, PAR. **Never the PAN** |

**Provisioning flow.** (1) The wallet collects the card and sends it encrypted, with device and account risk data. (2) The TSP checks the card range and asks the issuer. Apple names its server calls Required Fields, Check Card and Link and Provision. (3) The issuer decides. **Green** means approved with no extra step. **Yellow** means approved only after ID&V: an SMS or email one-time code, the issuer app, or a call to the bank. **Red** means declined. (4) The TSP creates the token in a token BIN range, tied to its domain (this TRID, this device, NFC / in-app / web), and stores the mapping and the PAR. (5) The token is personalised into the Secure Element, encrypted all the way, so Apple never sees it in clear. (6) At each payment, the Secure Enclave approves (Face ID / passcode). The Secure Element then builds a one-time cryptogram from a transaction counter, a key, and the terminal's unpredictable number or Apple's anti-replay value. The merchant forwards token + cryptogram, and the TSP checks the cryptogram, maps the token to the PAN and passes the PAN to the issuer.

The yellow path is where provisioning fraud happens (2015: some banks accepted the last four SSN digits as ID&V), so the simulator makes the ID&V choice visible.

**Token domain restriction controls** limit where a token works (a device-bound Apple Pay token can't be reused as card-on-file elsewhere). **PAR** (29 characters, starting with a 4-character BIN Controller ID) links every token of a PAN without exposing it: fraud, loyalty, transit.

**Lifecycle** (VTS and MDES): `active ⇄ suspended → deleted`, plus **PAN update**: on reissue the vault re-maps the token to the new PAN, so the phone keeps working.

**Storyline link (PAN declaration).** B3 already suspends tokens on a block. Design rule: a *lost* / *stolen* card block suspends its tokens; once the replacement is active the issuer re-maps them (the **card** was stolen, not the phone). A lost **phone** suspends only that device's token. A token used fraudulently is deleted. Re-map vs delete after a stolen block is an issuer choice (*to confirm*).

**CB.** CB routes Apple Pay for member banks since end 2024 (domestic first). CB TSP details, token ranges, the reported 2026 platform and co-badged token handling are all *to confirm*.

### 2. Cancellation vs refund vs chargeback

| Action | When | Who starts it | Money | Cardholder sees |
|---|---|---|---|---|
| **Full authorisation reversal** | Before clearing | Merchant | None moves. Hold released | Pending line disappears |
| **Partial reversal / partial capture** | Before clearing (hotel, fuel, split shipment) | Merchant | Only the final amount clears | Hold shrinks to the real amount |
| **Incremental authorisation** | Before clearing, final amount higher (hotel, car hire), allowed MCCs only (*to confirm* list) | Merchant | Hold grows | Hold grows |
| **Void** | Same day, before the batch is sent (acquirer term, often a reversal underneath) | Merchant | None | Nothing or a short-lived pending line |
| **Refund (credit)** | After clearing | Merchant | New credit transaction, merchant → cardholder | Debit and later a credit |
| **Chargeback** | After clearing, cardholder disputes, merchant did not fix it | Issuer, through the scheme | Acquirer (then merchant) debited, issuer credits the cardholder | Provisional credit, then final |

The rule a BA must write down: **cancel = reversal before clearing, refund after clearing. Chargeback is the scheme's tool when the merchant did not refund.** A refund on top of a chargeback pays the customer twice (rule R3). A dispute on an already-refunded payment is invalid (D8).

### 3. Visa chargeback lifecycle (public view)

1. **Cardholder disputes** with Harbor Bank. For fraud, the issuer first blocks the card and sends the fraud report (base F1–F5; a 10.x dispute needs the report, D3).
2. **Issuer raises the dispute** in Visa Resolve Online with a **dispute condition**, typically within **120 days** of the processing date (exceptions per condition, e.g. later delivery dates; *to confirm*).
3. **VCR workflow** comes from the category:
   - **Allocation**: 10 Fraud (10.1 EMV liability shift counterfeit, 10.2 EMV liability shift non-counterfeit, 10.3 other fraud card-present, 10.4 other fraud card-absent, 10.5 Visa fraud monitoring programme) and 11 Authorisation (11.1 card recovery bulletin, 11.2 declined authorisation, 11.3 no authorisation). Visa checks its own data, blocks invalid disputes up front (e.g. a 3DS-authenticated transaction) and assigns liability. There is no dispute-response step. The acquirer can only go to pre-arbitration.
   - **Collaboration**: 12 Processing errors (12.1 late presentment, 12.2 incorrect transaction code, 12.3 incorrect currency, 12.4 incorrect account number, 12.5 incorrect amount, 12.6 duplicate processing / paid by other means, 12.7 invalid data) and 13 Consumer disputes (13.1 not received, 13.2 cancelled recurring, 13.3 not as described / defective, 13.4 counterfeit merchandise, 13.5 misrepresentation, 13.6 credit not processed, 13.7 cancelled merchandise or services, 13.8 original credit not accepted, 13.9 non-receipt of cash at ATM). The merchant answers with evidence (**dispute response / representment**) within **30 days** at scheme level. Acquirers give merchants less: Adyen gives 18 days, and 9 days for US/Canada since July 2025.
4. **Pre-arbitration**: the issuer disagrees with the response, or the acquirer contests an allocation decision. The other side has **30 days** to accept or decline.
5. **Arbitration**: Visa decides with no new evidence, and the loser pays a filing fee (USD 600 cited by Adyen; *to confirm* current amount and review fees).

**Who pays.** Chargeback: issuer credits the cardholder, acquirer is debited and passes it to the merchant (plus a contract fee). Won representment: money back to the merchant; issuer re-bills or absorbs. Accepted or missed deadline: merchant pays. Arbitration: loser pays amount + fee.

**Liability shift.** For card-absent fraud (10.4), a transaction **authenticated with 3-D Secure** (Visa ECI 05) moves fraud liability to the issuer, so the dispute is blocked. ECI 06 ("attempted") is treated differently across regions and sources (*to confirm*). There are exclusions (missing CAVV, some MCCs, monitoring programmes). The shift covers only **fraud** conditions, never 13.x "not received". **Wallet payments with a cryptogram**: public processor sources treat device-tokenised in-app and web payments as authenticated for the fraud shift. The exact ECI and rules per scheme are *to confirm*. Card-present EMV chip or contactless follows the 10.1/10.2 EMV liability rules.

### 4. CB equivalents (FR)

- **Opposition** (block) → base rule B3. **Unauthorised payment**: the bank refunds immediately, at the latest by the **end of the next business day** (CMF **L133-18**), unless it has good reason to suspect fraud by the cardholder (and must then inform the Banque de France). Gross negligence is the bank's to prove (L133-23, *to confirm* wording). The cardholder must contest within **13 months** of the debit (**L133-24**). The €50 excess before opposition (L133-19) does not apply to remote payments without strong authentication (*to confirm* current text).
- **Impayé** is the CB chargeback. The motifs and deadlines sit in the CB rulebook, which is not public. Adyen shows reason **45** "Fraude – opération contestée", which cannot be defended, an outer time limit around 400 days in its auto-defence, and auto-defence when the payment was refunded or 3DS-authenticated. All CB codes and deadlines stay *to confirm*. The simulator shows Visa-like stages with French labels: impayé → représentation → pré-arbitrage (term *to confirm*).
- The **13-month customer window** is not the **interbank impayé window**: the bank may owe the L133-18 refund even when it can no longer raise an impayé.

## Worked examples

**EN · Visa · Harbor Bank**

1. **Merchant cancels before clearing.** Harbour Hotel (demo) authorises €65.00 on crd_hb_008 for a room. The guest cancels the same evening. The merchant sends a **full reversal**: the hold disappears, nothing clears and no refund is needed. If it had only sent a "refund", the mock answers 409 R1 "not cleared yet: use reversal" (PL-01). Cost: none.
2. **Customer returns goods.** Northwind Shoes (demo) clears €120.00 on 2 Nov. On 8 Nov one pair (€40) comes back, and the merchant **refunds €40**: a credit line appears in 1–5 days. The merchant cannot reverse any more, because the payment is cleared (409 P6, PL-02). Cost: the merchant keeps the interchange paid on the sale (*to confirm* per acquirer contract).
3. **"Goods not received", won by the merchant.** Atlas Home (demo), €89.00, cleared 12 Oct, delivery expected 20 Oct. The cardholder says it never came. Harbor Bank raises **13.1** on 8 Nov (Collaboration; respond by 8 Dec). The acquirer debits the merchant €89 plus a fee. The merchant represents with signed proof of delivery dated 18 Oct. The issuer accepts, the €89 goes back to the merchant, and the issuer re-bills or absorbs the amount. With tracking only and no signature, the issuer files pre-arbitration. If the merchant declines it, Visa arbitrates and the loser pays the fee (PL-03, PL-06).
4. **Fraud on the stolen card (storyline).** crd_hb_005 is stolen and blocked (43). Before the block, two card-absent purchases cleared at QuickGift Codes (demo) on 30 Oct: €349 without 3DS and €219 with 3DS (ECI 05). The cardholder flags both, the fraud analyst confirms, and FR-2026-1301 is sent. **10.4** on the €349 → Allocation, merchant liable (no authentication). **10.4** on the €219 is **blocked: liability shifted to the issuer** (D9), so Harbor Bank carries €219 (PL-04). Lesson for the PRD: 3DS adoption moves fraud cost from merchants to the issuer. Had the thief added the card to a phone, the red path (card blocked → T3) would have stopped it once the block was live. That is why the 160-minute Exception File delay in SQL Q5 matters for tokens too.

**FR · CB · Banque Lumière**

1. **Annulation avant remise.** Une boulangerie (démo) autorise 12,40 € deux fois par erreur. Le commerçant **annule** la seconde autorisation avant la remise en compensation : elle n'est pas compensée et le client ne voit qu'une opération. Coût : aucun.
2. **Remboursement après retour.** Une boutique (démo) a compensé 79 €. Le client renvoie l'article et le commerçant émet un **remboursement (avoir)** de 79 €. Une annulation n'est plus possible après la remise. Si le client a déjà contesté auprès de sa banque, le commerçant ne rembourse pas en plus (double paiement, règle R3).
3. **Marchandise non reçue, représentation gagnée.** 89 € chez un marchand en ligne (démo). Le porteur conteste, et Banque Lumière émet un **impayé** (motif « marchandise non reçue », code CB *to confirm*). Le commerçant **représente** avec la preuve de livraison signée et l'impayé est rejeté : les fonds reviennent au commerçant. Délais de représentation : *to confirm* (règlement CB).
4. **Fraude sur carte volée.** crd_bl_001 est volée le 2 nov., et la mise en opposition est faite dans l'app. Le porteur conteste deux paiements à distance, de 60 € et 140 €. Banque Lumière **rembourse le porteur au plus tard le jour ouvrable suivant** (L133-18), sans attendre l'issue interbancaire. Elle émet ensuite un impayé « fraude » (motif *to confirm*) sur les 60 € sans 3-D Secure, à la charge du commerçant. Pour les 140 € authentifiés 3-D Secure, la banque supporte la perte : transfert de responsabilité, et Adyen défend automatiquement ces impayés. Le porteur pouvait contester jusqu'à 13 mois après le débit (L133-24).

## Simulator designs

### A · Tokenization simulator (`tokenizing-cards`)

**Inputs (first screen, 4):** test card (picker of fixtures, masked, with the expected path shown: green / yellow / red) · wallet (Apple Pay, Google Pay, merchant card-on-file) · device (iPhone, Watch, Android, browser + risk low / medium / high) · token requestor (prefilled demo TRID). Advanced: wallet account age, ID&V method, channel.

**Screen:** a step rail of 7 steps (Request → TSP checks → Issuer decision → ID&V → Token created → Pay (cryptogram) → Lifecycle). The **swimlane sequence diagram** (Cardholder · Wallet · TSP/vault · Issuer · Device SE · Merchant) draws one arrow per step. A **"who sees what" panel** shows, per actor, which fields are visible (PAN, token, PAR, cryptogram). The **token vault table** lists token_ref, masked token, masked PAN, PAR, TRID, device, domain, status and history. Lifecycle buttons (suspend / resume / delete / block card / replace card) are enabled only when the transition is allowed, with a tooltip naming the rule (T11–T15).

**Formats (all fake and labelled):** tokens in the fictional `400099` range, Luhn-valid (`4000990000000012` …), masked 6+4. Token expiry = card expiry. Token reference `TRF-HB-0001`. PAR `Z999FAKEPAR…` (29 characters, `Z999` = fictional BIN controller). Cryptogram `FAKE` + 16 random hex with ATC. ECI illustrative. Demo OTP `123456`. Every value has a "Demo value, not real cryptography" badge.

**Decision rules:** T1–T6 (unknown PAN 422; blocked / expired / fraud watch or high risk → red; medium risk or account < 30 days → yellow; else green), T9 three wrong codes → deleted.

**Endpoints and tests:** `/tokens` family (7 paths) and TK-01…06 in the YAML.

### B · Payment lifecycle & chargeback simulator (`handling-chargebacks`)

**Inputs (3 + scheme):** payment (amount, card, merchant, channel, 3DS yes/no/attempted, wallet) · event (cancel before clearing, partial capture, refund, chargeback) · reason (Visa condition picker grouped 10–13 with plain-English labels / motif CB *to confirm*) · scheme Visa EN / CB FR.

**Timeline UI states:** `authorised → (reversed | partially_reversed) → captured → (partially_)refunded`. From `captured`: `chargeback → represented → won`, or `→ pre_arbitration → arbitration → won | lost`, or `merchant_accepted`. Each node shows the date, the deadline countdown ("respond by 8 Dec, 30 days, *to confirm*"), the workflow badge (Allocation / Collaboration) and a **ledger strip** ("who carries the money now": cardholder / issuer / acquirer / merchant, with arrows per move and fees). Illegal events are greyed with the reason ("Cleared: use refund"). A "+30 days" clock button exercises deadlines. FR mode adds the L133-18 J+1 refund banner and the 13-month contest window, separate from the impayé track.

**Rules engine:** P3–P7, R1–R3, D1–D16 (defined in the YAML). Deadlines live in one table `{scheme, step, days, confidence: public|to_confirm, source_url}` so the tool shows the source and the amber badge.

**Endpoints and tests:** `/payments` family, representment, pre-arbitration, `/_mock/clock` (9 paths) and PL-01…06 in the YAML.

**Exports:** timeline as Markdown, ledger as CSV, BPMN of the dispute (lanes Cardholder, Issuer, Visa/CB, Acquirer, Merchant), test cases into the API tester.

## Skill outlines

**`skills/tokenizing-cards/SKILL.md`**
- Front matter: `name: tokenizing-cards` · `description:` "Explains and specifies network tokenization and wallet provisioning (Apple Pay, Google Pay, card-on-file): actors, green/yellow/red issuer decisions, ID&V, token lifecycle, PAN update and links to card blocking. Produces flow diagrams, issuer decision rules, API specs and test cases. Use when someone asks about tokens, DPAN, VTS, MDES, wallet provisioning or token lifecycle."
- §1 Actors table (holds · sees · never sees) · §2 green / yellow / red rules, ID&V methods and their weaknesses, BA questions · §3 lifecycle state diagram and triggering events (device lost, card lost / stolen, replacement, fraud on token) · §4 paying with a token (cryptogram, ECI, domain restrictions; merchant stores token + PAR, never the PAN) · §5 output contract: sequence diagram, decision table, OpenAPI fragment, TK-style tests, open questions · §6 safety: test PANs only, no real keys or cryptogram algorithms, demo values labelled · §7 checklist: every transition tested, block → token effect specified, no PAN in URLs or logs.

**`skills/handling-chargebacks/SKILL.md`**
- Front matter: `name: handling-chargebacks` · `description:` "Analyses and specifies payment cancellation, refunds and chargebacks: reversal vs refund, Visa dispute conditions (10–13, Allocation vs Collaboration), representment, pre-arbitration, arbitration, deadlines, liability shift and who pays; CB impayés with CMF L133-18/L133-24. Produces timelines, rules, evidence checklists, API specs and test cases. Use when someone asks how to cancel, refund or charge back a card payment, or to design a dispute process."
- §1 decision tree: reversal / partial capture / refund / chargeback (cleared? merchant reachable? fraud?) · §2 classify: condition → workflow → required documents → deadline · §3 timeline and ledger per stage, deadlines with source and confidence · §4 merchant evidence per condition, when to accept · §5 liability (3DS / ECI, EMV, wallet cryptogram; fraud only) · §6 France / CB: L133-18, L133-24, impayé motifs *to confirm*, two tracks · §7 output contract: timeline, ledger CSV, BPMN, P/R/D rules table, PL-style tests, open questions · §8 checklist: allowed + refused case per transition, inclusive / exclusive deadlines stated, no double credit, rulebook values *to confirm*.

## Decisions for Analyst Kit V2

1. **Two new tools and skills, ids `tokenizing-cards` and `handling-chargebacks`**, registry 18 → 20, group K. Both run fully in-page on the shared mock: no AI, no network.
2. **Mock API additions are defined in `tokens-and-disputes-openapi.yaml`**. Owner C serves them in the in-page mock and at `/mock/harbor|lumiere/v1`, same reset and clock. On merge, keep one `Problem` schema and add a `POST /_mock/clock` control.
3. **Base rule B3 now has a token effect we can test**: block → tokens `suspended`. Replacement → PAN update via `resume` + `new_card_id`. Fraud on the token → delete. TK-05 joins the storyline (crd_hb_008 block → UAT-06).
4. **Fake values are labelled everywhere**: the `FAKE` prefix, `demo_only: true`, a badge in the UI, and the 400099 token range. The tool never calls anything "secure", "encrypted" or a "cryptogram" without the word *demo*. No key material and no algorithm (no ARQC/TAVV computation) is shipped.
5. **The tokenization screen has three views:** step rail + swimlane sequence diagram + "who sees what" matrix, with the token vault table underneath. Export JSON (vault), Markdown (walk-through) and Mermaid / BPMN sequence.
6. **The lifecycle screen is a timeline with a ledger strip** ("who carries the money now"), deadline countdowns, Allocation / Collaboration badges and greyed illegal actions that name the rule. Export Markdown, CSV and BPMN.
7. **Deadlines and fees live in one data table with `confidence` and `source_url`**. Public values: 120 days, 30 days, and the USD 600 fee as cited by Adyen. Region-specific, CB and fee values render amber *to confirm*.
8. **Liability shift in the mock is D9:** 10.4 on 3DS ECI 05 or a wallet cryptogram is blocked as "liability shifted". ECI 06 is treated as shifted, with a *to confirm* note.
9. **FR mode shows two tracks**: the cardholder's rights (L133-18 J+1, L133-24 13 months) and the interbank impayé (rulebook, *to confirm*). This is the most common confusion in French dispute specs.
10. **Seeds:** 4 EN + 4 FR worked examples above, each one click in its tool. EN #4 and FR #4 reuse the stolen-card storyline (crd_hb_005 / crd_bl_001, QuickGift Codes M-011 from SQL Q3).
11. **The 12 test cases (TK-01…06, PL-01…06) ship as "Try a test case" chips in the API tester too**, so the owner's "how to test an API" demo can include tokenization and chargebacks.
12. **Bug in the existing fixtures:** the base PANs (`4000000000001014` …) are **not Luhn-valid**, although `06` and the base YAML say they are. Preferred fix: correct the check digits everywhere (`…1018, …1026, …1034, …1042, …1059, …1067, …1075, …1083`, CB `…2016, …2024, …2032`), so the tester's Luhn warning (06 decision 5) is consistent. Alternative: keep them and fix the wording. This file keeps the current PANs; its token numbers are Luhn-valid.
13. **Out of scope for V2:** incremental authorisation API, Mastercard dispute codes, Rapid Dispute Resolution / Verifi, Compelling Evidence 3.0 detail. They are mentioned in help text only, *to confirm*.

---
name: tokenizing-cards
description: Explains and specifies network tokenization and wallet provisioning (Apple Pay, Google Pay, card-on-file) - actors, green/yellow/red issuer decisions, ID&V, token lifecycle, PAN update and the link with card blocking (opposition). Produces sequence diagrams, issuer decision rules, API specs and test cases. Use when someone asks about tokens, DPAN, device account number, VTS, MDES, the CB tokenisation service, PAR, wallet provisioning, token lifecycle or what happens to Apple Pay when a card is blocked.
---

# Network tokenization and wallet provisioning

You act as a payments Business Analyst on the issuer side (Harbor Bank in English / Visa terms, Banque Lumière in French / CB terms). A tokenization spec is good when **every actor knows what it holds and never sees**, every lifecycle transition has an allowed and a refused test, and the effect of a **card block on its tokens** is written down.

Tool: **Tokenization simulator** in Analyst Kit (`#/tool/tokenization`) runs the flow below on the demo mock (rules T1–T18, B3). Use it to show the flow, then paste its Markdown export into the spec.

## 1. Actors (EMVCo vocabulary)

| Actor | Example | Holds | Sees | Never sees |
|---|---|---|---|---|
| Cardholder | Adds the card in Wallet | The plastic card | Last 4 of the device account number | PAR, cryptogram key |
| Token requestor (TRID) | Apple Pay, Google Pay, a merchant card-on-file | Token reference, card art | Last 4 of the PAN, masked token | The token in clear (Apple), the PAN |
| Token Service Provider + vault | Visa Token Service (VTS), Mastercard MDES, CB service for CB-routed tokens (*to confirm*) | Token ↔ PAN mapping, domain restrictions, status, PAR | Everything | — |
| Issuer | Harbor Bank / Banque Lumière | PAN, the decision | PAN, token reference, PAR, device, wallet | The cryptogram key |
| Device (Secure Element) | iPhone, Watch, Android | Token (DPAN) and cryptogram key, one token per device | — | The PAN |
| Merchant / acquirer | Shop, PSP | Token, cryptogram, ECI, PAR | Masked token | **The PAN, ever** |

## 2. Provisioning decision (green / yellow / red)

1. The wallet sends the card (encrypted) with device and account risk data.
2. The TSP checks the card range, the TRID and the domain, then asks the issuer ("Check Card" then "Link and Provision" in Apple's public description).
3. The issuer decides:
   - **Green**: approved, token active at once.
   - **Yellow**: approved only after **ID&V** (one-time code by SMS or email, issuer app, call to the bank). New device, young wallet account, medium risk.
   - **Red**: declined. Card blocked, expired, on fraud watch, high device risk.
4. The TSP creates the token in a token BIN range, bound to its **domain** (this TRID, this device, NFC / in-app / web) and stores the mapping and the **PAR** (29 characters, first 4 = BIN controller ID).

Questions a BA must ask: which signals send a card to yellow? Which ID&V methods are strong enough (2015: some banks accepted the last 4 digits of an SSN, and provisioning fraud followed)? How many wrong codes before the token is deleted? How long is a code valid?

## 3. Lifecycle

`pending_idv → active ⇄ suspended → deleted`, plus **PAN update**.

| Event | Effect on tokens | Rule in the demo mock |
|---|---|---|
| Phone lost | Suspend that device's token only | T11 |
| Phone found | Resume | T12 |
| Card lost or stolen (opposition) | Suspend **every** token of the PAN; the next cryptogram is refused | B3, T16 |
| Replacement card active | Re-map the tokens to the new PAN (same token, same PAR): the cardholder keeps paying without adding the card again | T13 |
| Resume while the card is blocked and no replacement is active | Refused | T13 |
| Fraud on the token | Delete; a token suspended for fraud cannot be resumed | T14 |
| Delete | Final: any later call is refused | T15 |

Re-map vs delete after a **stolen** card block is an issuer choice (*to confirm* with the TSP contract). Write it down either way.

## 4. Paying with a token

The Secure Enclave approves (Face ID / passcode), then the Secure Element builds a **one-time cryptogram** from a transaction counter (ATC), a key and the terminal's unpredictable number. The merchant forwards token + cryptogram + ECI; the TSP checks the cryptogram, maps the token to the PAN and passes the PAN to the issuer; the answer comes back with the token again. A cryptogram works **once** (replay refused, T18) and only inside the token's **domain** (T17: a device-bound Apple Pay token cannot be used as card-on-file elsewhere). The merchant stores token + PAR, never the PAN. Exact ECI per scheme and wallet: *to confirm*.

## 5. Output contract

1. Sequence diagram (Mermaid) with the 6 actors and one arrow per step.
2. Issuer decision table: rule ID · condition · green / yellow / red · ID&V method · rationale.
3. Lifecycle table (§3) including the card-block effect.
4. "Who sees what" matrix (§1).
5. API fragment (`POST /tokens`, `/tokens/{ref}/idv|suspend|resume|delete|cryptogram`) with error codes and rule IDs. The token number never goes in a URL; use the token reference.
6. Test cases TK-style: green, yellow with a wrong then a right code, red per reason, replay, domain restriction, block → suspended → refused cryptogram → PAN update.
7. Open questions with an owner.

## 6. Safety

Test PANs only (Luhn-valid test ranges, masked 6+4). No real keys, no cryptogram algorithm (no ARQC / TAVV computation): every token, PAR and cryptogram in an example is a **labelled demo value**. In French, use *jeton*, *opposition*, *porteur*, *émetteur*, *mise à jour du PAN*.

## 7. Quality check

- Every lifecycle transition has an allowed and a refused test.
- The block → token effect is specified (suspend, re-map or delete) and tested.
- No PAN in URLs, logs or merchant-side screens.
- Scheme facts not in public sources are marked *to confirm* (CB TSP details, token ranges, co-badged token handling).
- Hand-off: sequence → `modeling-processes`; rules → `writing-functional-specs`; tests → `testing-apis` and `managing-xray-tests`; block flow → `handling-chargebacks` for the fraud that may follow.

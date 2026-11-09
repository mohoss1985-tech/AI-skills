{"client": "Harbor Bank (sample)", "skill": "writing-user-stories", "lang": "en", "title": "Stories: block a card and flag unknown payments"}
===INPUT===
Stories for RG-01 to RG-05 and RG-09 of the PAN declaration SFD (app side). Jira. Users: cardholders in the mobile app.
===OUTPUT===
### Story map

| Step | Pick the card | Declare | After the block | Unknown payments |
|---|---|---|---|---|
| **Release 1** | See my cards with image and last 4 digits | Block with a reason (RG-01, RG-02) | Confirmation, replacement ordered | Flag payments of the last 90 days (RG-05) |
| Later | — | — | Unblock a lost card within 24 h (RG-09) | Follow the fraud case status |

---

### 1 · Block a lost or stolen card
`Jira` · Epic: PAN declaration · Labels: cards, app, fraud · Source: RG-01, RG-02, RG-04

As a **cardholder**, I want to block my card in the app with the reason, so that nobody can pay with it.

**Example map**
- *Rule:* three reasons → *Example:* lost, stolen, used without my permission
- *Rule:* refused at once with the code of the reason → *Example:* stolen → next authorisation declined with 43
- *Rule:* wallet tokens suspended → *Example:* Apple Pay stops working
- *Question:* can I block a virtual card? → **answered: yes, same flow**

```gherkin
Scenario: Cardholder blocks a stolen card
  Given Sam has a Visa debit card ending 4821 that is active
  When Sam declares the card ending 4821 as "Stolen" and confirms
  Then the app shows "Your card ending 4821 is blocked"
  And an authorisation on the card 10 seconds later is declined with response code 43
  And the Apple Pay token of the card is suspended

Scenario: Cardholder with two cards picks the right one
  Given Sam has cards ending 4821 and 1177
  When Sam opens "Block a card"
  Then both cards are shown with their image and last 4 digits
  And no card is selected by default
```

**INVEST:** all ✓ → **Ready**

---

### 2 · Flag payments I don't recognise
`Jira` · Epic: PAN declaration · Labels: cards, app, fraud · Source: RG-05

As a **cardholder**, I want to flag the payments I don't recognise after blocking my card, so that the bank can investigate and get my money back.

```gherkin
Scenario: Flag two unknown payments
  Given Sam blocked the card ending 4821 as "Used without my permission"
  And the card has 12 payments in the last 90 days
  When Sam flags the payments of 89.90€ and 240.00€ on 2 November
  Then the app shows "We've sent 2 payments to our fraud team"
  And a fraud case with these 2 payments is created for fraud operations

Scenario: Payments older than 90 days can't be flagged
  Given the card has a payment on 1 July
  When Sam opens "Payments I don't recognise" on 2 November
  Then the payment of 1 July is not listed
```

**INVEST:** all ✓ → **Ready**. Rule RG-07 (fraud report before dispute) is a fraud operations story, linked here.

---

### 3 · Unblock a card I found
`Jira` · Epic: PAN declaration · Source: RG-09

```gherkin
Scenario Outline: Unblock a lost card
  Given Sam blocked the card ending 4821 as "<reason>" at 18:00 on Saturday
  And "<attempt>" authorisation was attempted since
  When Sam tries to unblock it at <time>
  Then the result is "<result>"

  Examples:
    | reason | attempt | time           | result                 |
    | Lost   | no      | Sunday 10:00   | Card unblocked         |
    | Lost   | no      | Sunday 18:01   | Unblock no longer possible |
    | Lost   | one     | Sunday 10:00   | Unblock no longer possible |
    | Stolen | no      | Sunday 10:00   | Unblock not possible for a stolen card |
```

**INVEST:** N ⚠️: Legal confirmed the 24 h rule, but the wording of "Unblock no longer possible" is still to review → **Ready after wording review**.

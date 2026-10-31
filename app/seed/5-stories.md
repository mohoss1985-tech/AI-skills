{"client": "Hexa card scheme (sample)", "skill": "writing-user-stories", "title": "Stories: issuer fraud-score settings in the member portal"}
===INPUT===
Stories for FR-3 and FR-4 of the fraud score PRD. Jira.

FR-3: issuers opt in to the fraud score per BIN range in the member portal.
FR-4: issuers can set a score threshold for stand-in (STIP): above it, STIP declines.
Users: issuer fraud managers (role "Fraud admin"). Changes take effect at 02:00 the next night (config batch). Any change must be approved by a second Fraud admin of the same issuer (4-eyes). BIN ranges are 8 digits. Threshold 0-999, empty = no threshold.
===OUTPUT===
### Story map

| Step | Find my BIN ranges | Configure | Approve | Check it's live |
|---|---|---|---|---|
| **Release 1** | List my issuer's BIN ranges with status (FR-3) | Opt a range in or out; set the STIP threshold (FR-3, FR-4) | Second Fraud admin approves (4-eyes) | See "active from 02:00" and the history |
| Later | Search across many ranges | Bulk changes by file | — | Email when live |

---

### 1 · Opt a BIN range in to the fraud score
`Jira` · Epic: Fraud score · Labels: member-portal, fraud, lclf · Source: FR-3

As an issuer's **Fraud admin**, I want to opt a BIN range in to the fraud score, so that our authorisation requests for those cards carry the network score.

**Example map**
- *Rule:* only ranges of my own issuer are shown → *Example:* Fraud admin of Banque Lumière sees 45671200–45671299, not Crédit Azur's ranges
- *Rule:* a change needs a second Fraud admin's approval → *Example:* Léa requests, Marc approves; Léa can't approve her own request
- *Rule:* takes effect at 02:00 the next night → *Example:* approved Tuesday 16:00, live Wednesday 02:00
- *Question:* can a pending request be changed? → **answered: no, cancel and create a new one**

```gherkin
Scenario: Fraud admin opts a range in, a second admin approves
  Given Léa and Marc are Fraud admins of issuer "Banque Lumière"
  And BIN range 45671200-45671299 is "Not scored"
  When Léa requests "Scored" for this range
  And Marc approves the request on Tuesday at 16:00
  Then the range shows "Scored · active from Wednesday 02:00"
  And the history shows the request by Léa and the approval by Marc

Scenario: No self-approval
  Given Léa requested "Scored" for BIN range 45671200-45671299
  When Léa opens the request
  Then the "Approve" button is not shown
  And the page reads "Another Fraud admin must approve this change"

Scenario: Ranges of other issuers are not visible
  Given Léa is Fraud admin of "Banque Lumière"
  When she opens "BIN ranges"
  Then only ranges of "Banque Lumière" are listed
```

**Checklist:** audit trail of who requested and approved · works with keyboard only · pending requests expire after 7 days *(to confirm)*

**INVEST:** I ✓ · N ✓ · V ✓ · E ✓ · S ✓ · T ✓ → **Ready**

---

### 2 · Set the stand-in decline threshold
`Jira` · Epic: Fraud score · Labels: member-portal, fraud, stip · Source: FR-4

As an issuer's **Fraud admin**, I want to set a fraud score above which stand-in declines, so that risky transactions aren't approved when our host is down.

**Example map**
- *Rule:* threshold 0–999, empty = no threshold → *Example:* 850 accepted; 1000 rejected; empty clears it
- *Rule:* only for ranges that are "Scored" → *Example:* field disabled on a "Not scored" range
- *Rule:* same 4-eyes and 02:00 rules as story 1

```gherkin
Scenario Outline: Threshold validation
  Given BIN range 45671200-45671299 is "Scored"
  When Léa enters "<value>" as stand-in threshold
  Then the form shows "<result>"

  Examples:
    | value | result                                       |
    | 850   | Request created, waiting for approval        |
    | 0     | Request created, waiting for approval        |
    | 1000  | Enter a score between 0 and 999              |
    | abc   | Enter a score between 0 and 999              |
    |       | Request created: threshold will be removed   |

Scenario: Threshold applies in stand-in
  Given range 45671200-45671299 has a stand-in threshold of 850, active
  And the issuer host doesn't answer
  When a request for card 4567120012345678 arrives with score 910
  Then stand-in declines with the response code for suspected fraud
  And the issuer receives the stand-in advice with the score
```

**INVEST:** all ✓ → **Ready**. The last scenario is an end-to-end test for the authorisation team; link it to their story.

---

### Not ready
- **Bulk changes by file:** format not defined. Spike first.
- **Email when live:** who receives it? Ask the issuer advisory group.

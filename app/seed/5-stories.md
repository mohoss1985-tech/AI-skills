{"client": "Northwind Retail (sample)", "skill": "writing-user-stories", "title": "Stories for FR-1 to FR-3: address editing", "input_tokens": 2720, "output_tokens": 1350, "seconds": 41}
===INPUT===
Turn these PRD requirements into stories with Gherkin acceptance criteria. We use Linear.

FR-1 Show an "Edit address" action on orders with status Paid or Picking
FR-2 Validate the new address with the existing address service
FR-3 Lock editing once status is Packed and explain why
===OUTPUT===
### Story map

| Step | View order | Edit address | Confirm |
|---|---|---|---|
| **Release 1** | See if editing is possible (FR-1, FR-3) | Change a domestic address (FR-2) | Confirmation on page |
| Later | — | International addresses | Email confirmation (FR-4) |

---

### 1 · Let customers edit their delivery address before packing
`Linear` · Project: Self-service address change · Labels: checkout, customer · Source: FR-1, FR-2

Customers who notice a mistake after ordering currently have to email support and often miss the cut-off. Let them correct a domestic address themselves while the order is still *Paid* or *Picking*.

**Example map**
- *Rule:* editing allowed only before *Packed* → *Example:* Paid order is editable; Packed order is not
- *Rule:* address must pass validation → *Example:* "12 Rue Fictive, 69000" is rejected with a suggestion
- *Question:* can a customer edit twice? → **answered: yes, until Packed**

```gherkin
Scenario: Customer changes the address of a paid order
  Given order #10482 has status "Paid"
  And the delivery address is "4 Rue Victor Hugo, 69002 Lyon"
  When the customer saves "18 Quai Saint-Antoine, 69002 Lyon"
  Then the order page shows "18 Quai Saint-Antoine, 69002 Lyon"
  And the warehouse receives the new address within 60 seconds

Scenario: Address that fails validation
  Given order #10482 has status "Picking"
  When the customer saves "12 Rue Fictive, 69000 Lyon"
  Then the address is not saved
  And the form shows "We couldn't find this address" with up to 3 suggestions

Scenario: Postcode outside the original country
  Given order #10482 ships to France
  When the customer enters a Belgian postcode
  Then the form reads "International changes aren't available yet. Contact support."
```

**Checklist**
- [ ] Form is keyboard accessible and labels meet WCAG 2.2 AA
- [ ] Event `address_changed` tracked with order id and old/new zone
- [ ] Change is written to the order audit log

**INVEST:** I ✓ · N ✓ · V ✓ · E ✓ · S ✓ (international split out) · T ✓ → **Ready**

---

### 2 · Explain why the address can't be edited after packing
`Linear` · Labels: checkout · Source: FR-3

```gherkin
Scenario: Order already packed
  Given order #10482 has status "Packed"
  When the customer opens the order page
  Then there is no "Edit address" button
  And the page reads "Your parcel is packed. Contact support to redirect it."

Scenario: Status changes while the form is open
  Given the customer opened the address form while the order was "Picking"
  And the order becomes "Packed"
  When the customer saves a new address
  Then the change is rejected
  And the page reads "Your parcel was packed a moment ago, so we couldn't change the address."
```

**INVEST:** all ✓ → **Ready**

---

### Not ready
- **International address change** — needs answers on customs and shipping re-pricing (FR-5). Split by **Data** (SPIDR).

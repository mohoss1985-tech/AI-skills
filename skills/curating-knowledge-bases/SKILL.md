---
name: curating-knowledge-bases
description: Audits and organises the business knowledge that feeds a RAG assistant or chatbot - coverage against customer questions, freshness, ownership, duplicates and contradictions, writing standards that retrieve well, metadata for filtering, and a content-gap backlog from production logs. Use when someone asks to prepare or clean a knowledge base for an AI assistant, brief content writers, find why the bot can't answer, plan FAQ or help-centre content, or set up knowledge governance.
---

# Knowledge Base Curation for RAG

You act as the Product Owner who knows that most "AI errors" are content errors. The assistant can only be as right as the documents it retrieves, so knowledge gets the same backlog discipline as features.

## 1. Audit what exists

For each source (help centre, product sheets, tariffs, procedures, FAQs), record: owner, audience (customers / advisors), last review date, format, access rights, and whether it is the single source of truth. Flag:

- **Stale:** not reviewed within the agreed cycle, or references old prices, apps, dates
- **Duplicates & contradictions:** the same question answered differently in two places
- **Internal-only content** that must never reach customers
- **Unretrievable formats:** scanned PDFs, images of tables, content hidden in tabs or accordions

## 2. Coverage map

Cross the top customer intents (from `prioritizing-ai-use-cases` or logs) with the content:

| Intent | Monthly volume | Approved source | Covers the full answer? | Gap |
|---|---|---|---|---|

Every "No" in coverage becomes a content story before it becomes an assistant story.

## 3. Writing standards that retrieve well

Brief writers with these rules, and add them to the definition of done for content:

- **One question per article or section**, with the customer's wording in the title ("I can't log in to the app")
- **Answer in the first two sentences**, then steps, then conditions and exceptions
- **Self-contained sections:** each one makes sense alone, because retrieval returns fragments, not pages (repeat the product name, avoid "see above")
- **Explicit conditions:** who it applies to, amounts, deadlines, channels
- **Plain text tables** instead of images; no key information only in links or attachments
- **Dated and owned:** last review date and owner on every page

## 4. Metadata for filtering

Agree a minimal schema so retrieval can filter before it ranks: `audience`, `product`, `customer_segment`, `channel`, `language`, `valid_from` / `valid_to`, `confidentiality`, `owner`. Wrong-audience or expired content must be filtered out, not just ranked lower.

## 5. Governance loop

- **Review cycle** per content type (tariffs: on every change; procedures: quarterly; FAQs: half-yearly)
- **Change trigger:** any product, price or app change creates a content task in the same release
- **Gap backlog from production:** weekly review of "no answer found", thumbs-down and escalated conversations; each becomes a content fix, a retrieval fix or a scope decision
- **Golden-set update:** when content changes, update expected answers in the evaluation set (`evaluating-rag-quality`)

## 6. Output contract

1. Source inventory with owner, freshness and flags
2. Coverage map with gaps ranked by intent volume
3. Content backlog as user stories (writer-ready, with acceptance criteria)
4. Writing standard and metadata schema for the team
5. Governance RACI and review calendar

## 7. Quality check

- [ ] Every high-volume intent has one approved source or a content story
- [ ] Contradictions are resolved with the content owner, not by the model
- [ ] Internal-only content is excluded by metadata, not by prompt instructions
- [ ] The production feedback loop has an owner and a weekly slot

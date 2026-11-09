# 08 · Market & positioning · Analyst Kit V2

Research date: 2026-11-08. Scope: who uses it, how comparable repos present themselves, how to show V1 → V2, naming, licence, legal, and the first three demos.

## Sources

- IIBA, *2026 Global State of Business Analysis*: 2,120 respondents in 122 countries; 69% say AI is having a positive effect on their careers, 5% negative; 81% say BA is formally recognised in their organisation; average salary $93,186. https://www.iiba.org/business-analysis-blogs/insight-enables-confidence-the-2026-global-state-of-business-analysis-report/ · https://vancouver.iiba.org/stories/the-iiba-2026-global-state-of-business-analysis-report
- IIBA: about 30,000 members, 120 chapters in 40+ countries. https://www.iiba.org/business-analysis-membership/chapters/ · https://www.iiba.org/globalassets/about-iiba/press-releases/files/iiba-launches-new-chapter-platform-supporting-global-community-engagement.pdf
- Postman, *2025 State of the API*: 5,700+ respondents; 82% of organisations are API-first to some degree (74% in 2024, 66% in 2023); 25% fully API-first; one in four design APIs for AI agents; 40M+ Postman users. https://nordicapis.com/a-deep-dive-into-the-state-of-the-api-2025/ · https://www.businesswire.com/news/home/20251008162423/en
- Atlassian Q4 FY25 shareholder letter: Jira >125K customers, Confluence >100K. https://www.sec.gov/Archives/edgar/data/1650372/000165037225000028/teamq42025shareholderlet.htm
- In this repo, `market/README.md` (Free-Work, 740 BA/PO freelance listings in Île-de-France, Sept–Oct 2026): workshops 68%, UAT 57%, specs 52%, banking context 49%, Jira 30%, SQL 25%, Postman/Swagger 3%, AI/GenAI 12% at 505 €/day against a 475 € median.
- Comparable repos: Hoppscotch (MIT, ~80.8k stars; README has logo, tagline, badges, banner, features, "Demo" link to the web app, then a 3-step usage section). https://github.com/hoppscotch/hoppscotch · Bruno (local-first, plain-text collections). https://www.usebruno.com/compare/bruno-vs-hoppscotch · https://openalternative.co/alternatives/postman
- How READMEs and portfolios get screened: https://dev.to/kazkozdev/i-studied-how-github-readmes-are-actually-evaluated-here-are-the-5-things-that-matter-2epd · https://kindatechnical.com/technical-interview-preparation/github-portfolio-what-recruiters-actually-look-for.html · https://resources.instahyre.com/blog/github-profile-checklist/
- Keep a Changelog 1.1.0. https://keepachangelog.com/en/1.1.0/ · Versioned subfolders on GitHub Pages: https://glebbahmutov.com/blog/versioned-doc-pages
- Visa Brand Center ("only approved partners… may use Visa Brand assets"), brand standards, and legal terms. https://corporate.visa.com/en/about-visa/brand.html · https://corporate.visa.com/content/dam/VCOM/corporate/about-visa/documents/visa-brand-standards-sept2025.pdf · https://www.visa.com/en-us/legal
- EU trade mark referential use, Art. 14(1)(c) EUTMR, subject to the "honest practices" test in Art. 14(2) (CJEU, Audi C-334/22, 2024). https://cliffordchance.com/expertise/services/intellectual-property/global-ip-updates/2024/q2/the-court-of-justice-of-the-european-union-sheds-some-light-on-the-interpretation-of-the-referential-use-of-a-trademark.html · https://ipkitten.blogspot.com/2024/01/eu-court-of-justice-clarifies-scope-of.html
- PCI DSS v4.0.1 req. 6.5.5: no live PANs in pre-production. https://withpci.pages.dev/requirements/6/6.5/6.5.5 · Test PAN 4111 1111 1111 1111 (Visa Developer community). https://community.developer.visa.com/t5/Sandbox-Test-Data/Example-of-Expired-Fraund-Payment-Cards/m-p/9778
- EU AI Act Art. 50 transparency duties apply from 2 Aug 2026. https://artificialintelligenceact.eu/transparency-rules-article-50/ · https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026
- Name check: web searches for "Analyst Kit" / "AnalystKit" turned up no software product with that name. The nearest are aixigo "Analysing Kit" (portfolio analytics for banks) and generic "toolkit" e-books. https://www.aixigo.de/portfolio-analysis-software

## Findings

### 1. Users, today's tools, the pain V2 removes

**Who.** (a) BA / PO / proxy-PO / AMOA in issuing, acquiring, processing and scheme projects. In Paris, 49% of BA/PO freelance listings are in banking, finance or insurance. (b) Functional QA / UAT testers on payment projects. (c) Consultancies (Big 4, ESN/IT service firms) that staff those roles and need fast onboarding material. (d) Hiring managers and recruiters who want proof of skill, not a CV line.

**Size.** The niche sits inside a large profession: IIBA has ~30k members, and its survey reaches 2k+ practitioners in 122 countries. Payments is a vertical within it. Two signals point the same way: 82% of organisations are API-first (Postman), and 85%+ of large enterprises run Jira/Confluence. BAs therefore meet APIs and Jira every week, yet only 3% of listings name Postman. Postman is expected of developers, not of BAs, which leaves the gap a "Postman for BAs" fills. AI is now a positive for 69% of BAs, and AI-PO listings pay ~+30 €/day. The market wants BAs who use AI, but nothing says it wants AI that replaces the BA.

**What they use today and what hurts:**

| Job | Today | Pain | V2 answer |
|---|---|---|---|
| Test an API | Postman (built for developers), or asking a developer | Workspaces, environments, scripts, account login; a BA only needs URL, method, auth, a body | 4-field tester, assertions, save as test case, export curl / Postman / pytest |
| Stories, specs, workshop reports | Confluence + Word + ChatGPT | Blank page; ChatGPT output is generic and knows neither the scheme nor the project | Guided inputs plus scheme-aware samples; the AI drafts, the BA edits |
| Backlog, WSJF | Excel + Jira | Formulas rebuilt for every PI; CSV import errors | WSJF calculator, Jira CSV export |
| SQL on authorisations | Ask the data team, or Excel pivots | Waiting days for a decline-code breakdown | SQL on a sample DB, with saved queries |
| UAT | Excel / Xray / Squash | Day-N dashboard rebuilt by hand | UAT tracker plus report |
| Process | Visio / draw.io / Miro | Not BPMN-valid, not versioned | BPMN render and edit |

Positioning sentence: **"The working tools a payments BA/PO needs between the workshop and the release, with AI where it saves time and none where it doesn't."**

### 2. How comparable repos present themselves (what earns the click)

- **Hoppscotch**, the reference for "Postman, lighter": logo, then a one-line tagline, badges, a banner image linking to the web app, a feature list, a **Demo** link, and a 3-step usage section ("enter URL → Send → view response"). The pattern that works is a product you can use in the browser with no install, reachable in one click.
- **Bruno** sells one idea ("local-first, plain-text, Git-native"). One clear differentiator beats a long feature list.
- Recruiter screening is skim-based. The figures (7–30 s) come from secondary sources, but the sources agree that the README and a working demo link are read and the code mostly is not. A ~10 s GIF plus a deploy link changed reader questions from "what is this?" to "how did you do it?" (dev.to). Pin 2–4 polished repos.
- What makes a reader understand in 30 s: (1) a tagline with the user, the job, and the domain; (2) a big "Try it" button above the fold; (3) one GIF of the API tester firing a real request; (4) a 3-row "what you can do in 60 s" table; (5) a screenshot grid, then the details. Keep badges few and meaningful (demo, licence, EN/FR, last release). A wall of shields reads as vibe-coded.

### 3. Showing V1 → V2

Options weighed: tags/Releases only (standard, but recruiters don't browse tags), `v1/` + `v2/` source folders (visible, but duplicated code and V1 no longer untouched), CHANGELOG (expected, text only), README before/after (read in 30 s), Pages serving both versions (live proof).

**Recommended combination:** tag the current state `v1.0.0` (GitHub Release "V1: document generators", with the V1 static export zipped as an asset). Develop V2 on `main` as the only codebase. Build Pages from two sources: V2 at the root, and V1 at `/v1/`, rebuilt from the `v1.0.0` tag in the workflow (`git worktree add v1 v1.0.0 && python export_static.py --out _site/v1`). Add `CHANGELOG.md` with `## [2.0.0] - 2026-11-xx` and `## [1.0.0] - 2026-11-02`, grouped Added / Changed / Removed. Add a README section "**V1 → V2: from document generators to working tools**" with 3 paired screenshots (API: V1 test plan document vs V2 live tester; SQL: V1 query text vs V2 run results; Backlog: V1 markdown vs V2 WSJF table) and a link to each live version. If DESIGN_SPEC picks a separate repo, the tag + `/v1/` approach still applies.

### 4. Naming and licence

- **"Analyst Kit"** has no visible software collision (only aixigo's "Analysing Kit", a different name in a different market). It is generic, so it can't be strongly protected, but it is safe to use. Don't file a trademark. The repo slug `AI-skills` undersells V2. Rename the GitHub repo to `analyst-kit` (GitHub redirects old URLs, though the Pages URL changes, so update links), or keep the slug and fix the title.
- **V2 subtitle:** "Analyst Kit · working tools for payments BAs & POs" (FR: « Analyst Kit · les outils de travail du BA/PO paiement »). Avoid "AI" in the main name: AI is a feature, and "AI skills" reads as prompt collections.
- **Licence:** the repo has **no LICENSE** today, which legally means "all rights reserved" and blocks reuse by clients. Add **MIT** for code (app, scripts, skills). Add **CC BY 4.0** for samples, docs and screenshots (`app/seed/`, `examples/`, `market/`), with attribution so the work stays credited to the owner. Explain both in a `LICENSE` + `LICENSE-docs` pair and a README line. Scheme names stay outside both licences (see §5).

### 5. Legal / compliance

- **Trademarks.** Visa limits brand assets (logo, flag, card art) to approved parties. Naming Visa or CB in text to describe the rules a sample follows is referential use (Art. 14(1)(c) EUTMR; US nominative fair use) if it is honest: no logo, no Visa/CB colours or card art, no suggestion of endorsement, and the name not used in the product name. Visa's standards also ask for "Visa" in that capitalisation (not "VISA").
- **Disclaimer** (README footer + demo footer + app About), EN and FR: *"Independent project. Not affiliated with, endorsed or sponsored by Visa Inc. or GIE Cartes Bancaires. Visa and CB are trademarks of their respective owners, used only to name the rules the fictional samples follow. Samples are illustrative, based on public information, and are not scheme rules."*
- **Confidential rules.** The owner is ex-network, so the risk is real. Use only public sources: Visa Core Rules public edition, CMF articles, public CB pages. Keep the "*to confirm*" markers. No CB2A/CBAE specs, no internal codes, no screenshots of member portals. Add a `SOURCES.md` per sample or reuse the existing sources feature. Run a grep for internal-only terms before release.
- **Data privacy.** Use only test PANs (4111 1111 1111 1111, 4000…, Luhn-valid but non-issued), always shown masked where realistic (`411111******1111`). Names are fictional (Harbor Bank, Banque Lumière) and there is no real personal data. In the API tester, warn "Don't paste real card numbers or production tokens". Add a client-side Luhn check that flags a PAN which looks real and isn't on the test-PAN list, in line with the spirit of PCI DSS 6.5.5. The static demo must send nothing to any server except the user-chosen URL. Say so in the UI.
- **AI disclosure.** EU AI Act Art. 50 applies from 2 Aug 2026. For a portfolio, strict scope is limited, but transparency costs nothing: label AI-drafted deliverables "Drafted with Claude, reviewed by <owner>", and add a README section "How AI is used" (which tools need AI, which work without, where data goes). This also answers the recruiter question "did you build it or did the AI?" Credit Claude Code as a build tool honestly, and show the owner's decisions (specs, market method, samples) as the human work.

## Decisions for Analyst Kit V2

1. **Positioning line:** "Working tools for payments BAs & POs: test an API, query authorisations, write the stories, run the UAT. AI where it helps, the tool works without it." The audience order is BA/PO in payments, then QA/UAT, then consultancies, then recruiters.
2. **Name:** keep **Analyst Kit**, with V2 subtitle "working tools for payments BAs & POs" / « les outils de travail du BA/PO paiement ». Don't use "AI" in the title. Propose renaming the repo slug to `analyst-kit` (owner's call, since it changes the Pages URL).
3. **README order (EN and FR):** title + subtitle, then a large ▶ *Try the live demo* button, a 10 s GIF of the API tester, "3 things to try in 60 seconds" (the demos below), a screenshot grid (light/dark), V1 → V2 before/after, the 18 tools table, Run locally, How AI is used, Licence & disclaimer. Use at most 4 badges.
4. **Versioning:** tag the current state `v1.0.0` with a GitHub Release. V2 is `v2.0.0` on `main`. Pages serves V2 at the root and V1 frozen at `/v1/`, built from the tag. Add `CHANGELOG.md` in Keep a Changelog format. No `v1/` and `v2/` source folders.
5. **Licence:** add `LICENSE` (MIT, code) and `LICENSE-docs` (CC BY 4.0, samples, docs, screenshots). Scheme trademarks are excluded.
6. **Disclaimer:** add the non-affiliation text from §5 in the README, the web demo footer and the app About, in EN and FR. Show no Visa/CB logos, colours or card art anywhere, and write "Visa", not "VISA".
7. **Data:** use test PANs only, masked in display. The API tester shows a "no real card data" warning and a Luhn/test-list check. Use fictional institutions. Run a release-time grep check for confidential or internal terms. Every scheme-specific figure stays marked *to confirm* or cites a public source.
8. **AI disclosure:** add an "AI-assisted draft" label on generated deliverables and a README section "How AI is used" that separates tools working offline from AI-assisted ones.
9. **Demo 1: "Test a card-blocking API in 60 seconds"** (EN Visa / FR CB «Mettre une carte en opposition»). Script: open the demo, pick the sample "Block a lost card", see 4 fields pre-filled (Method `POST`, URL of the public mock, Auth `Bearer demo-token`, Body `{ "pan": "4111111111111111", "reason": "LOST" }`), press **Send**. You get 201 plus the JSON with `status: BLOCKED`. Add the assertion `status == 201` and `body.status == "BLOCKED"`, which goes ✓ green. Change the reason to `INVALID` and send again: 400, and the assertion goes red. Click **Save as test case**, then **Export → curl / Postman / pytest**. The mock must be CORS-enabled and work from the static demo (decided with the API-tester research). Record it as a 10 s GIF for the README.
10. **Demo 2: "From workshop notes to user stories"** (Workshop → Stories). Script: paste 8 lines of messy workshop notes (lost-card declaration), click **Structure**. You get decisions, open questions and actions, then **Generate stories**: 5 stories with Gherkin acceptance criteria, then **Export Jira CSV**. In the static demo this replays the saved sample with a "this is what Claude produced" label. Locally it runs live. Show the side-by-side "your notes → structured" view.
11. **Demo 3: "Find the top decline codes with SQL"**. Script: open SQL on the sample `authorisations` table (10k fictional rows), choose the saved query "Approval rate & top decline codes", press **Run** (in-browser SQLite/WASM in the demo). You get the result table plus a bar chart: 51 insufficient funds, 05, 54 expired. Add `WHERE auth_date = '2026-10-15'` and run again. Export CSV. This proves "works without AI".
12. **Order and reach:** the three demos appear in this order in the README, on the demo home page ("Start here"), and in a 90 s screen recording for LinkedIn/CV. Each demo has EN (Visa) and FR (CB) variants, with one "Start here" path that a non-expert finishes in under 60 s.

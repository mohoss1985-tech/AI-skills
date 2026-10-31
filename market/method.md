# Method

1. **Collect.** The Free-Work search page calls a public JSON endpoint, `https://www.free-work.com/api/job_postings`. For each keyword (*product owner*, *business analyst*, *proxy product owner*, *AMOA*, *PO data*, *PO IA*) I fetched every page with `contracts=contractor` and `locations=fr~ile-de-france~~` (Île-de-France, Paris included), 50 per page with a one-second pause, and removed duplicates by id: 964 listings.
2. **Filter.** A listing was kept if its title or job category names a BA / PO role (product owner, PO, proxy PO, business analyst, BA, AMOA / MOA, functional analyst, functional consultant or project manager, product manager): 740 listings. A few are remote listings attached to Île-de-France.
3. **Count.** For each skill or tool, a case-insensitive pattern was searched in the title, the description, the candidate profile and the skill tags, counting each listing at most once. Broad words were tightened by hand after spot checks, for example `\bexcel\b` so that *excellent* doesn't count and `\bvisio\b` so that *vision* doesn't.
4. **Day rate.** The middle of the min–max range, for listings that give one of at least 250 €.

Limits: listings are short and agencies copy them across sites, so the percentages show what clients write down, not everything the job involves. Re-run it before relying on the numbers for a negotiation.

# PizzaScript Content Agent — Audit & Improvement Report

2026-11-20

## Summary

The pipeline works end to end, but it chooses topics on guesses and publishes without seeing results; the fixes that matter most are free.

- **Biggest risk:** idea research and the trend scan rely on Google Search grounding, which Google lists as unavailable on the free Gemini tier. Research may be failing or running ungrounded today.
- **Biggest gap:** Search Console isn't connected, so the system can't see clicks, rankings or which posts need a refresh.
- **Weakest logic:** all six topic scores (including search volume and difficulty) are numbers the model guesses.
- **Writing quality risk:** the whole article is written in one shot inside JSON, and code examples and claims are never checked.
- **Capacity:** about 20 free text requests a day — roughly 2 posts.

**Top 5 changes, in order**

1. Connect Search Console (free; the code already exists).
2. Replace Search grounding with a SERP API (Serper, 2,500 free queries) plus Jina Reader to read the top pages.
3. Write articles section by section, then check code blocks and claims before the SEO check.
4. Use real volume and difficulty (DataForSEO, pay as you go) and let the model judge only angle and fit.
5. Add embeddings in Supabase for duplicate detection and automatic internal links.

## How the system works today

Every post goes through nine steps; three of them carry most of the risk:

```
Ideas → Scoring → Brief → Draft → Banner → SEO check → Approve → Publish → Measure
         (guess)   (ok)   (unchecked) (ok)    (format only) (ok)   (09:00)  (GSC off)
                                                                              ↑
                                                              should tune scores (missing loop)
```

- **Amber (works but unreliable):** Scoring, Draft
- **Red (not running):** Measure (Search Console is off)
- **Dashed/missing:** the feedback loop from Measure back to Scoring that should tune the weights

Scoring and drafting run but can't be trusted without checks; measuring doesn't run at all, so nothing learns from published results.

## Topic research and selection

Topic choice runs on the model's guesses, not on data: all six scores are numbers Gemini makes up from a search snippet, and the main data source (Search Console) is not connected yet.

**Where ideas come from today**

| Source | How it works | Status |
| --- | --- | --- |
| Manual ideas | You add a query in Ideas | Working |
| Seed list | Keyword files from the old automation folder, imported once | Static, never refreshed |
| Trend scan | Daily Gemini + Google Search call: news from the last 48 h on the stack | Working, but uses quota daily even when nothing passes |
| Search Console gaps | Queries with 15+ impressions that no topic covers | **Off** — `GSC_SERVICE_ACCOUNT_JSON` is not set, so no data flows |

**Findings**

| # | Finding | Why it matters | Severity |
| --- | --- | --- | --- |
| T1 | Volume and difficulty are estimated by Gemini ("use Google Search to sanity-check"). Search results don't show volumes, so these are guesses | 30% of the score weight rests on invented numbers; the 0–100 scale gives false precision | High |
| T2 | The same call scores the idea and judges the five filters | The model grades its own reasoning; one negative judgement auto-archives the idea | High |
| T3 | Competitor research reads search snippets only (titles, domains) | "What do the top 5 miss?" can't be answered without reading the pages | High |
| T4 | No SERP facts are stored: ranking URLs, People Also Ask, featured snippet, video/forum results | The brief can't target the real search result layout | Medium |
| T5 | Cannibalism check is the model reading a list of titles; the GSC gap check is word overlap (60%) | Misses near-duplicates with different wording; flags false gaps | Medium |
| T6 | No feedback from results: scores are never compared with how published posts actually performed | Weights stay hand-set forever; the system can't learn what works for this site | Medium |
| T7 | Trend scan runs every morning and can create P0 topics | P0 trend topics jump the queue and spend the 20 daily requests | Low |

**What good looks like**: real keyword data (volume, difficulty, current ranking) feeds the score; Gemini only judges what needs judgement (angle, fit, uniqueness); and every published post's results tune the weights.

## Brief and writing

The writing rules are strong (insight-first openings, banned clichés, studio voice, verified facts only), but the whole article is written in one shot, inside JSON, with nothing checking that the facts and code are right.

| # | Finding | Why it matters | Severity |
| --- | --- | --- | --- |
| W1 | One call writes the entire 1,000–2,500-word article as HTML inside a JSON string, at temperature 0.75 | Malformed JSON already threw away a finished draft once; long single outputs drift and truncate; no section can be redone alone | High |
| W2 | Code examples are never checked | A wrong API or outdated syntax (e.g. pre-Next 16 code) in a technical post damages trust and rankings | High |
| W3 | No fact or claim check after writing | "Verified facts only" is an instruction, not a check — the model can still state unsupported claims qualitatively | High |
| W4 | The draft prompt doesn't get the research (competitor gaps, summary) — only the angle and outline | The article can't deliberately cover what competitors miss | Medium |
| W5 | All verified facts are pasted into every prompt, relevant or not; only 8 facts exist and they're unconfirmed seeds | Wasted tokens now; nothing to prove results with later | Medium |
| W6 | No secondary keywords, questions people ask, or entities to cover are planned | Posts target one phrase; long-tail traffic is left on the table | Medium |
| W7 | Experience signals are thin: no named author, bio or "what we saw on a real project" section | Google's E-E-A-T guidance rewards first-hand experience; "studio" voice alone doesn't show it | Medium |
| W8 | The old image prompt rules are still sent with every draft | The poster engine replaced them; ~300 wasted tokens per draft | Low |
| W9 | Quality gate runs only every 5 drafts and reads just the openings | Problems in the body of a post are never reviewed before publishing | Low |

## SEO check, linking, publishing and feedback

The SEO check is reliable but shallow (format checks only), and the feedback loop that should tell us what's working is switched off.

| # | Finding | Why it matters | Severity |
| --- | --- | --- | --- |
| S1 | Search Console isn't connected, so low-CTR alerts, ranking changes, query gaps and the 4- and 12-week performance checks never run | The system publishes blind: it can't see which posts work or need a refresh | High |
| S2 | The SEO check covers length, meta, links, banner and banned phrases — but not whether the target query appears in the title, first paragraph, a heading or the slug | A post can pass while barely targeting its query | Medium |
| S3 | No check for duplicate or near-duplicate content against our own posts | Two posts can compete for the same search | Medium |
| S4 | Internal links are planned per post, but older posts never get links to newer ones automatically (only via "link problems") | New posts start with few internal links pointing at them | Medium |
| S5 | No outbound links to authoritative sources (official docs, specs) are required | Technical posts that cite MDN, React or web.dev docs read as more trustworthy | Low |
| S6 | Publishing refreshes our cache but doesn't notify search engines | Bing and others can be told instantly via IndexNow (free); Google relies on the sitemap | Low |
| S7 | No site analytics (visits, time on page, contact-form conversions per post) | Search Console shows search clicks only, not which posts bring enquiries | Medium |
| S8 | Capacity: the free Gemini key allows 20 text requests a day; one post uses about 5–10 with retries | About 2 posts a day at most, and failed attempts burn the same budget | High |

## Tools, APIs and data sources

The most valuable additions are free or near-free: connecting Search Console, reading competitor pages with Jina or Firecrawl, and storing posts as embeddings in Supabase. One urgent catch: Google's pricing page says Search grounding is not available on the free Gemini tier, and our idea research and trend scan both depend on it ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)).

| Tool | What it adds | Cost (as found, Nov 2026) | Fit |
| --- | --- | --- | --- |
| [Google Search Console API](https://developers.google.com/search/apis) | Real clicks, impressions, positions and queries for our pages | Free | Already coded — only the service-account key is missing |
| Gemini model choice ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)) | Lighter Flash / Flash-Lite models may allow far more free requests than our current 20/day | Free; exact limits only shown in AI Studio | Check limits per model, then use the light model for scoring and checks |
| [Serper.dev](https://serper.dev) | Live Google results: top 10 URLs, People Also Ask, related searches | 2,500 free queries once; then about $0.30–$1 per 1,000 ([comparison](https://apiserpent.com/blog/serp-api-pricing-comparison)) | Replaces paid-only Search grounding for research |
| [DataForSEO](https://dataforseo.com) | Search volume, keyword difficulty, SERP data, backlinks | Pay as you go, about $0.60 per 1,000 SERP calls; $1 signup credit ([comparison](https://seranking.com/blog/dataforseo-alternatives/)) | Real volume and difficulty for scoring (fixes T1) |
| [Google Trends API (alpha)](https://developers.google.com/search/blog/2025/07/trends-api) | Official trend data, 5-year window | Free, by application | Apply now; useful for the trend scan |
| [Jina Reader](https://jina.ai/reader) | Turns any competitor page into clean text for Gemini | Free key: 500 requests/min | Read the top 5 pages for real gap analysis (fixes T3) |
| [Firecrawl](https://www.firecrawl.dev/pricing) | Same, plus search + crawl | 1,000 credits/month free | Backup to Jina |
| Supabase pgvector + Gemini embeddings | Meaning-based similarity between posts and ideas | Free (already on our Supabase) | Real cannibalism and internal-link suggestions (fixes T5, S3, S4) |
| [Gemini Batch API](https://ai.google.dev/gemini-api/docs/pricing) | Run drafts overnight at half price | Paid tier only, 50% off | Later, if we move to a paid key |
| [IndexNow](https://en.wikipedia.org/wiki/IndexNow) | Tells Bing, Yandex and others about new posts instantly | Free; Google does not support it | Small win for Bing / Copilot visibility |
| [Umami](https://umami.is) or Vercel Analytics + [Microsoft Clarity](https://clarity.microsoft.com) | Visits, engagement and enquiries per post; heatmaps | Free (Umami self-hosted; Clarity free) | Closes the business feedback loop (fixes S7) |
| TypeScript compiler in the worker | Compiles every code block in a draft | Free, already a dependency | Catches broken code before publishing (fixes W2) |

## Recommended changes and roadmap

Start with the free fixes that turn the lights on (data in, cheaper research), then improve writing quality, then let results tune the system. Each phase starts only when its gate is met, so later changes are judged on real data rather than guesses.

### Phase 1 · Free fixes (about 1 week, no cost)

- Connect Search Console
- Serper + Jina for research
- Quota pause, lighter model
- Query checks in SEO check
- Drop old image rules

**Gate:** Search Console data flowing

### Phase 2 · Research + writing (2–3 weeks, a few dollars a month)

- Write section by section
- Compile every code block
- Check claims against facts
- Real volume and difficulty
- Read top 5 pages for gaps

**Gate:** 5 posts pass every check

### Phase 3 · Learning system (after 6–8 weeks of data)

- Embeddings: duplicates, links
- Analytics + Clarity
- Tune scores from results
- Named author and bio
- IndexNow on publish

**Gate:** traffic trend is measurable

## Decisions for you

- [ ] **Search Console:** create the service account and add it to the pizzascript.com property? (Free, ~15 minutes.)
- [ ] **Research budget:** stay 100% free (Serper's one-time 2,500 queries + Jina), or allow a small pay-as-you-go budget (DataForSEO, roughly a few dollars a month at our volume)?
- [ ] **Gemini plan:** check per-model limits in AI Studio and switch to a lighter model, or enable billing on the key (cents per post, unlocks Search grounding and Batch at half price)?
- [ ] **Author identity:** publish under a named person with a bio (stronger E-E-A-T) or keep "PizzaScript studio"?
- [ ] **Analytics:** Vercel Analytics (simplest if the site moves to Vercel) or self-hosted Umami, plus Clarity?
- [ ] **Verified facts:** can you supply 10–20 real project results (with permission) so posts can cite numbers?

**Open question:** is Search grounding currently failing on our free key, or silently falling back? Confirm from the usage log before any change.

## Sources

Code audit: the agent's own files (`worker/rules.ts`, `worker/jobs/content.ts`, `worker/jobs/ops.ts`, `src/lib/studio/scoring.ts`, `src/lib/studio/content.ts`) and the job and usage logs from 2026-11-20. Prices and limits change often; confirm on each vendor's page before deciding.

- [Gemini API pricing (Search grounding, Batch API)](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Google Trends API alpha announcement](https://developers.google.com/search/blog/2025/07/trends-api)
- [SERP API pricing comparison 2026](https://apiserpent.com/blog/serp-api-pricing-comparison)
- [DataForSEO alternatives and pricing (SE Ranking)](https://seranking.com/blog/dataforseo-alternatives/)
- [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- [Jina Reader](https://jina.ai/reader)
- [IndexNow (Wikipedia)](https://en.wikipedia.org/wiki/IndexNow)
- [Vercel Analytics vs Plausible vs Umami, 2026](https://www.pkgpulse.com/guides/vercel-analytics-vs-plausible-vs-umami-privacy-first-2026)
- [Antigravity CLI, IDE and SDK (Google Cloud blog)](https://cloud.google.com/blog/topics/developers-practitioners/choosing-your-surface-antigravity-20-antigravity-cli-antigravity-ide-or-antigravity-sdk)

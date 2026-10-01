# The Security Diff — external story destinations

Date: 2026-10-02

Status: Approved and implemented on `feat/external-story-destinations`

Product specification: [original spec](../../../the-security-diff-implementation-spec.md)

Architecture baseline: [site design](2026-09-26-tsd-design.md)

Content environments: [fixture and production separation](../../design/content-environments.md)

Newsletter design: [Buttondown newsletter](2026-09-30-tsd-buttondown-newsletter-design.md)

## 1. Decision

Add an optional external destination to the shared story contract. This lets The Security Diff curate a story into an edition while sending readers directly to the original work when they select it.

The story remains a complete member of the publication. It appears in the dated edition, archive, category and tag indexes, feeds, and newsletter digest. TSD also retains a stable internal `/article/[slug]` provenance page for the story. The external URL changes the reader's normal click destination; it does not replace TSD's story identity or edition record.

The first intended use is the research paper **“GenRec: An LLM-Backed Recommendation Ranker at Netflix”**, categorized as `research`, with this exact destination:

```text
https://arxiv.org/html/2608.10257v2
```

The paper is adjacent AI and recommendation-systems research. TSD must not describe it as security research or invent security implications. Its source-backed summary, editorial signal, review identity, and publication timing require a separate content review before production publication.

## 2. Goals and boundaries

### Goals

- Make external research and articles first-class edition entries without copying their full text.
- Apply one destination rule consistently to the homepage, dated editions, indexes, feeds, and email.
- Preserve permanent TSD story identity, provenance, review metadata, and edition history.
- Clearly tell readers when a link leaves TSD.
- Support future externally hosted stories through validated content data rather than component-specific exceptions.
- Give external research an appropriate lead presentation without the vulnerability-specific patch diagram.

### Boundaries

- This feature does not fetch, mirror, sanitize, or render the external page.
- It does not introduce redirects, a runtime API, a database, a CMS, analytics, or link tracking.
- It does not authorize publication, deployment, newsletter approval, or email delivery.
- It does not add a general artwork system. The external research lead uses a restrained text-led composition and no third-party paper figure.
- It does not change internal destinations for stories that omit the new field.

## 3. Content contract

Add one optional field to both fixture and production story schemas:

```json
{
  "destination_url": "https://arxiv.org/html/2608.10257v2"
}
```

The field has these rules:

1. It is optional. Absence means the normal internal `/article/[slug]` destination.
2. It must be an absolute HTTPS URL.
3. The schema rejects HTTP, relative, credential-bearing, `javascript:`, `data:`, and other schemes.
4. It is editorially selected reader navigation, not an authoritative source record. The external work must still be present in `sources` with its source identity, canonical source URL, publication time when known, and retrieval time.
5. `id` and `slug` remain required and stable. Changing `destination_url` does not create a new story.
6. Production records still require `status`, `reviewed_by`, and `reviewed_at`; the external destination does not weaken publication gates.

The first production record will use `type: "research"` and `category: "research"`. It will cite the exact arXiv version used for the editorial summary. Author names, dates, claims, and results must come from that version or another checked-in authoritative source. If the edition copy uses “et al.” for space, the provenance page must retain enough source information to identify the paper unambiguously.

## 4. Identity and destination model

Create shared route helpers with separate responsibilities:

```ts
storyIdentityPath(story)   // always /article/<slug>
storyDestination(story)    // destination_url or /article/<slug>
```

`articlePath(slug)` remains the primitive for the internal route. `storyDestination` is the only helper reader-facing story links use. This prevents individual surfaces from interpreting the optional field differently.

The rules by surface are:

| Surface | Reader-facing link | Stable identity |
| --- | --- | --- |
| Homepage and dated edition | External destination | Internal article URL |
| Category and tag indexes | External destination | Internal article URL |
| Related coverage and filtered results | External destination | Internal article URL |
| Markdown feed | External destination | Internal story record |
| RSS item | External `<link>` | Internal `<guid>` |
| JSON Feed item | External `url` | Internal `id` |
| Newsletter story link | External destination | Edition and digest identity remain TSD-owned |
| Direct `/article/[slug]` visit | Internal provenance page | Internal article URL |

This separation keeps feed readers from treating a later destination correction as a new item. The permanent dated edition continues to use its TSD URL. CVE links generated from vulnerability records remain internal and are unaffected.

## 5. Reader experience

### Link treatment

External stories receive a restrained `External research ↗` cue next to their existing type or source metadata. The accessible name must make the external destination clear without repeating noisy labels around every link. Links open in the current tab. TSD does not force a new browsing context.

The cue is derived from the presence of `destination_url`; editors do not maintain a second boolean. Internal stories retain the existing visual treatment.

### Research lead

The lead component gains a content-aware external research presentation:

- the same newspaper hierarchy, rules, type scale, and warm-paper tokens;
- category and external-destination cue above the headline;
- headline, concise source-backed deck, source/date line, and editorial context;
- a clear text link such as `Read the paper ↗`;
- a typographic evidence panel for the source, paper version, and publication date when available;
- no vulnerability “patch decision” diagram;
- no copied arXiv figure, screenshot, abstract, or publisher artwork.

The component should choose the research presentation from story data, not from the GenRec slug. Other story types continue to use their supported layout. The implementation must remove the assumption that every lead can use the existing vulnerability diagram; it may retain that diagram only for stories for which it is truthful and relevant.

### Internal provenance page

Static generation continues to create `/article/[slug]` for an external story. Direct visitors see a concise TSD record containing:

- story type, category, publication date, and recorded review state;
- TSD's original summary, why-it-matters text, and supported editorial action;
- an obvious `Read original research ↗` link;
- source attribution, source publication date when known, retrieval date, and exact source URL;
- related TSD coverage when available.

The page must not reproduce the source's full text or figures. Its canonical URL remains the internal TSD article URL because it is TSD's provenance record. The external page remains the editorial destination for normal story clicks.

## 6. Edition, archive, feeds, and newsletter

An external story follows the same inclusion rules as every other story:

- it is counted once in the edition;
- it can be the lead story;
- it remains visible in its dated edition and archive;
- it appears on `/category/research` and its tag pages;
- filters include it and restore the same external link after client-side filtering;
- RSS, JSON Feed, and Markdown include its title and TSD-written summary;
- the newsletter digest includes its concise summary and external destination;
- the complete-edition newsletter link remains the permanent TSD edition URL.

RSS uses the permanent internal article URL as `<guid>` and the external destination as `<link>`. JSON Feed uses the permanent internal article URL as `id` and the external destination as `url`. These are deliberate identity semantics and must be covered by tests.

Newsletter rendering uses the same `storyDestination` helper. It does not copy the paper body or abstract. Existing approval rules still apply: an edition without newsletter metadata sends nothing, a draft permits preview only, and an approved digest remains subject to deployment and delivery gates. Adding the research story does not approve a newsletter send.

## 7. First story publication shape

The implementation will prepare a new production edition dated 2026-10-02 with GenRec as the lead research story. The content record will:

- use the exact paper title unless the user separately approves an editorial headline;
- set `destination_url` and the primary source URL to the exact arXiv v2 HTML URL;
- record the source publication timestamp and the actual retrieval timestamp;
- use a TSD-written concise summary rather than copied abstract text;
- describe the work as recommendation-systems research;
- keep unsupported security claims out of the headline, summary, rationale, and action;
- use no third-party illustration;
- retain the story across the dated edition, archive, category/tag pages, feeds, and digest preview.

The copy and actual `reviewed_by`/`reviewed_at` values require explicit user approval before the production content is committed as published. Newsletter metadata is omitted unless the subject, preview, selected stories, approver, and approval time receive their own review.

## 8. Security and integrity

- URL validation happens at build time from checked-in content. The browser receives only a reviewed HTTPS link.
- The feature performs no server-side or client-side fetch of arbitrary story URLs.
- External links are escaped by Astro and by the existing feed/newsletter renderers for their output formats.
- The external indicator is visible text, not color alone.
- A story cannot use an external destination to bypass required sources or production review metadata.
- Corrections update the content record and publication history; they do not silently change feed identity.
- Internal link validation continues to validate TSD routes. Tests assert external `href` values without making production builds depend on third-party availability.

## 9. Documentation changes

Implementation updates must reconcile these existing statements:

- The architecture and authoring guide should say every story retains a canonical internal record while an optional external destination may control normal reader navigation.
- The content recipes and templates should document when to use `destination_url`, source/destination separation, external labels, and lead-artwork rules.
- The newsletter design and authoring guide should replace the claim that every story click always uses `/article/[slug]` with the approved identity/destination model.
- The delivery ledger should record changed paths, commands, test results, visual evidence, publication state, and remaining authorization gates.

## 10. Verification

Implementation is complete only when focused tests prove:

1. fixture and production schemas accept a valid HTTPS destination and reject unsafe or malformed values;
2. stories without `destination_url` keep their current internal links;
3. lead, story card, filtered results, category, tag, and related-story links use the external destination consistently;
4. the external cue is visible and accessible, and links do not force a new tab;
5. `/article/[slug]` is still generated and shows the provenance record with the original-source link;
6. RSS separates external `<link>` from internal `<guid>`;
7. JSON Feed separates external `url` from internal `id`;
8. Markdown and newsletter links use the external destination while edition links remain internal;
9. the research lead does not render the vulnerability diagram or a copied external image;
10. production validation still rejects unreviewed or fixture content;
11. internal link checks pass without requiring the external site to be reachable during the build;
12. browser checks at 320, 390, 768, 1024, and 1440 pixels in both themes show no overflow, misleading artwork, lost focus state, or broken hierarchy.

Use a synthetic HTTPS destination such as `https://example.com/research-paper` in fixture tests. Use the real arXiv URL only in the reviewed production content and its source-backed assertions.

## 11. Delivery sequence

1. Implement and verify the reusable schema, route helper, UI, feed, newsletter, and provenance behavior on a feature branch based on the Buttondown newsletter work.
2. Update authoring and architecture documentation and record test/visual evidence.
3. Prepare the 2026-10-02 GenRec edition copy and render it locally for editorial review.
4. Record real review metadata only after the user approves the exact copy.
5. Open a reviewable pull request. Merge, production deployment, newsletter approval, and email delivery remain separate authorized actions governed by the existing release gates.

This ordering prevents a one-off paper entry from defining inconsistent behavior and prevents feature approval from being treated as publication approval.

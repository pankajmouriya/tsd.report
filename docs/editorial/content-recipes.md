# Editorial recipes

Use these as adaptable outlines alongside the [authoring guide](authoring-guide.md). Lengths guide layout and editorial depth; they are not acceptance rules. Omit sections that add no value and keep important qualifications visible.

| Story type | Suggested shape | Evidence emphasis | Typical structure |
| --- | --- | --- | --- |
| `news` | What changed → affected audience → practical consequence → next step | Primary announcement, exact date and scope | Brief, 200–500 words |
| `advisory` | Vendor change → affected/fixed scope → mitigations → verification | Authoritative advisory, branch/range semantics | Brief, 300–700 words |
| `cve` | Identifier and dated evidence → exposure → exploitation uncertainty → supported response | Separate CVSS, EPSS, KEV, exploitation, fixes | Brief; current UI labels this historical fixture |
| `incident` | Confirmed event → observed timeline → cause evidence → response → unknowns | Observations versus hypotheses; no inferred victim attribution | Brief for updates; essay for investigations |
| `research` | Research question → method → demonstrated finding → limitations → engineering implications | Primary paper/write-up; reproduction status; interpretation clearly labeled | Essay, 800–1,600 words |
| `original` | Reader's problem → thesis → worked example → boundary/failure mode → conclusion | Accurate authorship, source-backed claims, honest test status | Essay, 1,000–1,800 words |
| `explainer` | Concrete question → model → example → counterexample → practical use | Definitions, assumptions, limits of analogy | Essay or short brief |
| `tool` | Problem solved → trust/deployment model → observed evaluation → limits → who benefits | Official repository/docs, exact tested version and setup if tested | Brief, 300–700 words |

## Lead selection

Choose a story whose consequence merits the edition's strongest emphasis and whose evidence can sustain it. A strong lead has a specific headline, a useful deck, clear affected scope, a supported action, and appropriate artwork if used. A score alone does not make it the lead.

Set the edition's `lead_story` to its existing ID. Keep its type and stable internal article record. External research may add `destination_url`; its lead uses a text-led source panel and normal clicks open the original work. Other unrelated subjects still require suitable original artwork or omission of the vulnerability figure; see the authoring guide.

## Reusable section patterns

### Brief

1. **Opening:** what changed, when, and for whom.
2. **Scope:** what the evidence does and does not establish.
3. **Response:** a supported next step, relevant constraints, and verification.
4. **Sources:** claim-specific citations, dates, and remaining uncertainty.

### Technical essay

1. A question grounded in an engineer's task.
2. The mental model needed to reason about it.
3. A worked example; mark hypothetical inputs explicitly.
4. A contextual diagram where words need support.
5. Failure modes and the limits of the example.
6. A conclusion that answers the opening question.

### Incident analysis

Use a timestamped timeline only for sourced events. Separate “observed,” “reported by the organization,” and “our inference.” An absent event is a gap, not evidence it did not happen. Include the source cutoff date and what would change the assessment.

### Research commentary

Separate the authors' demonstrated result from your engineering interpretation. Describe experimental conditions, threat model, and limits of generalization. “We reproduced” requires an actual recorded reproduction.

For a curated paper that should remain on its publisher or repository, set an absolute HTTPS `destination_url`, keep the primary work in `sources`, and retain an internal slug. TSD summaries, feeds, and email must remain concise original commentary. Do not copy an abstract or paper figure merely because the normal headline click leaves TSD.

## Local examples to learn from

- [Historical patching brief](../../content/fixtures/articles/patching-the-edge.md): dated context, action, sources, figure, and visible unknowns.
- [Agent-boundary essay](../../content/fixtures/articles/monitoring-ai-agents.md): sustained argument, technical diagram, illustrative example, limitations, and footnotes.
- [Editorial seed rationale](editorial-seed-rationale.md): existing seeds and further reading candidates, with maturity distinctions. A promising candidate is not automatically verified publication material.

These local examples remain unreviewed fixtures. Their existing prose or metadata is not independent evidence for a new claim.

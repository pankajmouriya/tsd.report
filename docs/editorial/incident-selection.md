# Selecting security stories from incident leads

Status: editorial policy proposed for review on 2026-10-30. It governs which leads Codex should develop into article PRs after this document is accepted. It does not authorize any individual article, change the live monitor, or permit unattended publication.

## Keep discovery broad; select stories by event

The [rolling lead issue](https://github.com/pankajmouriya/tsd.report/issues/22) is a research inbox. A monitored link is neither a confirmed incident nor an instruction to publish. Collect broadly, including original reports, maintainer responses, technical explainers and ecosystem changes. Evaluate a *story*, not each link. Group reports by the same event, affected artifact and timeframe before making an editorial decision. Similar product names or CVEs alone do not prove that two events are the same.

Keep every distinct duplicate source URL in the event's research record and in a proposed PR's evidence/reference list. Include the grouped references in the article's Sources section, while citing only the sources that actually support each claim. Repeated or syndicated reports are references, **not** independent corroboration. The current candidate contract permits at most 30 article sources; if a group exceeds that limit, retain its full list in the PR and flag the limit for a separate contract decision. One event normally gets one canonical article. Later reporting becomes a new immutable revision only when it changes the supported timeline, scope, risk, response or interpretation. Preserve the original publication and correction history. A separate incident, such as a later compromise of the same project, keeps a separate identity.

The current collector keeps at most 500 leads in its checkpoint and shows 40 in the issue, ordered by observed changes. These limits and the issue order are **not** a notability ranking or a complete archive. Lack of a source date stays unknown; a page's update time or date-like text in an HTML title must not be presented as its original publication date. A future queue improvement can expose event groups and older leads without narrowing collection.

## Choose the correct editorial lane

| Lane | What qualifies | What it must not imply |
| --- | --- | --- |
| Incident | A documented compromise, malicious release, campaign or certificate-trust failure | A vulnerability alone proves an intrusion or malicious distribution |
| Major vulnerability | An important disclosed flaw with verified affected conditions and upstream response | A demonstration or high score proves exploitation in the wild |
| Technical explainer | Original synthesis that teaches a mechanism and a useful engineering decision | A rewrite of another vendor's article is original research |
| Ecosystem news | A material change to security practice, infrastructure or maintainer workflow | A new product or program is itself a security incident |

The current incident candidate contract supports supply-chain compromises, dependency vulnerabilities and certificate-trust events. It does **not** provide an approved on-demand publication workflow for general ecosystem news or technical explainers. Keep those leads for the appropriate story lane; do not mislabel them to pass the incident publisher. Adding those workflows is separate implementation work.

## Evidence gate before scoring

Codex may recommend an article PR only after it can identify the actual event or change, its original date where known, and source-backed facts that justify a reader-facing account. Use the affected maintainer, vendor, registry or root program for what it did and the scope it knows; use the original researcher for its own observations; use an independent platform's report for that platform's response. Prefer official statements for affected versions, fixed releases and maintainer actions. “Official” is not an automatic answer to a conflicting research claim: attribute both, preserve the uncertainty and check subsequent updates. A collection of articles repeating one report is one source of evidence, not corroboration.

Confirm every material version, artifact, exploitation statement, count and action against its source. Record source identity, URL, original publication date if available, update/data date if available and actual retrieval time. Check whether an older post merely resurfaced through an updated feed. Do not turn unknown into zero, safe, unaffected or a confirmed compromise. The existing source-capture, claim and preview checks remain required; they cannot prove the editorial judgment in this policy.

If that evidence gate fails, keep the lead under investigation. Do not assign a numerical score to make missing evidence appear reliable.

## Rank viable stories for editorial attention

Score the *event or proposed article* after the evidence gate. The score prioritizes Codex's drafting time; it is an editorial estimate, not a security metric or a publication trigger.

| Dimension | Points | Decision basis |
| --- | ---: | --- |
| Documented reach or trust importance | 0–4 | A major runtime, widely used distribution or trust path, multiple affected organizations, or a clearly bounded niche. Do not infer installations or exposure from stars, downloads or a vendor headline alone. |
| Reader decision value | 0–2 | Concrete inventory, containment, patch, trust-store or maintainer decision; for news/explainers, a practical architecture or workflow decision. |
| Distinct new information | 0–2 | A newly verified event or material finding scores above a repeated headline. A useful original synthesis can score here even when its component vulnerabilities are older. |
| Technical insight | 0–2 | Supported explanation of attack path, affected conditions, evidence limits and defensive consequence. Marketing claims alone score zero. |

**7–10:** shortlist for a draft after checking lane fit. **4–6:** keep watching and re-evaluate on new evidence. **0–3:** retain as background. The editor can request a lower-scoring story with a written reason; the evidence gate never has an override. A score does not create a PR, approve copy, merge, deploy or send a newsletter. Every PR still needs the actual editor review or merge and existing validation.

Do not substitute CVSS, EPSS, KEV membership, the number of reporting sites, a named vendor or the age of a post for these judgments. Those signals answer different questions and must retain their own provenance.

## Technical explainer depth

An explainer earns a draft only if TSD can add its own useful synthesis. Require (1) a correct causal mechanism, (2) affected conditions and meaningful boundaries, (3) at least one concrete engineering check or response, (4) primary advisories or original research for factual claims, and (5) the unresolved limits. Compare related flaws only where the comparison improves a reader's decision. A vendor overview such as [Aikido's shell comparison](https://www.aikido.dev/blog/what-are-shell-vulnerabilities) is a useful lead and reference, but its existence alone is not a reason to republish it. Product pitches, copied diagrams, long excerpts and unsupported exploit claims do not satisfy this depth test.

## Calibration against the editor's selected leads

These are **research dispositions**, not approved article claims or precomputed scores. Read the current original sources again before drafting; several statements are evolving.

| Story group and selected lead IDs | Lane and handling | Lead evidence and source priority |
| --- | --- | --- |
| October LiteLLM (`c966c124146b8dbb57ad676e`, `af9fb53128fc3f1cf888fe78`) | One incident already [published](https://tsd.report/article/litellm-october-2026-release-compromise/). Assess a revision for the October 10–21 timeline if it adds material reader value; do not open another article for each report. | Start with [LiteLLM's investigation](https://docs.litellm.ai/blog/security-incident-oct-21-2026-attack-chain), then keep [Socket's earlier-workflow finding](https://socket.dev/blog/litellm-attack-timeline), [Socket's release report](https://socket.dev/blog/litellm-compromise) and [Microsoft's analysis](https://www.microsoft.com/en-us/security/blog/2026/10/23/inside-the-litellm-1-107-0-supply-chain-compromise-credential-theft-through-python-startup-hooks/) as distinct attributed references. LiteLLM's later audit-log account adds context that was unavailable to Socket's initial analysis. |
| PHP2Shell (`e75be43c9f9cc162a07720bb`; related `4a59615041b968ae61d1e051`) | Major vulnerability, one story covering the related PHP flaws and response. Do not label it a software-distribution compromise. | Use [PHP's security release](https://www.php.net/releases/) and [the PHP Foundation's account](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) for upstream scope/fixes; [Wiz's original research](https://www.wiz.io/blog/php2shell-php-rce) for its demonstrated mechanism; [Cloudflare](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/) only for its observed protection or attack telemetry. Keep the [Socket lead](https://socket.dev/blog/php-critical-rce-patches) as a reference. |
| Anthropic OSS Scanner (`b0664ff7d272430c8d019956`) | Ecosystem news, **not** an incident. Investigate the effect on maintainer triage and disclosure; the current incident PR flow cannot publish this lane. | Lead with [Anthropic's announcement](https://www.anthropic.com/research/launching-opt-in-vuln-finding-service-for-open-source) and [program page](https://red.anthropic.com/oss-scanner/); retain [Socket's report](https://socket.dev/blog/anthropic-oss-scanner). Distinguish fast, model-generated reports from Anthropic's separately human-reviewed disclosure process. |
| GhostAction (`26051426ffd56ea1d502cacc`) | One campaign story if current evidence supports the scope and practical response. | Compare [Socket's October investigation](https://socket.dev/blog/ghostaction-cloud-credentials) with [GitGuardian's longitudinal research](https://blog.gitguardian.com/ghostaction-github-actions-supply-chain-attack-returns/). Do not combine counts from different time windows or assume every targeted repository leaked secrets. |
| MemTensor (`263c23fc192f685089bb57ff`) | Supply-chain compromise candidate; investigate artifact and registry evidence before drafting. | [Socket's original package analysis](https://socket.dev/blog/memtensor-compromise) identifies reported npm and PyPI artifacts and its evidence limits. Check current maintainer/registry response before asserting final affected versions, remediation or downstream impact. |
| Shell comparison (`9512570d276d186fa3f8b9a4`) | Technical explainer candidate if TSD can meet the depth test above. It is not one combined incident. | Treat [Aikido's overview](https://www.aikido.dev/blog/what-are-shell-vulnerabilities) as a lead; use the separate PHP, Node.js and other primary advisories for each mechanism, scope and mitigation. |
| Node2Shell (`e963cc7cefc98a3b4cf55317`) | Major dependency/runtime vulnerability story if the technical and response evidence is strong. Do not claim malicious Node.js releases or observed exploitation without evidence. | [Node.js's security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) governs its own affected lines and fixes; [Aikido's analysis](https://www.aikido.dev/blog/node2shell-nodejs-brotli-rce-cve-2026-111497) is a supporting technical lead. Check other Brotli consumers against their own advisories. |
| eMudhra (`16ef103f7a12655dcf92e427`; related `c78cf468160e1a45508001b3`) | One certificate-trust incident with a source-specific timeline and scope. | Lead with [eMudhra's evolving statement](https://emudhra.com/en/post/certificate-security-incident/) for its investigation, [Mozilla's response](https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/) for Firefox/NSS action, and [Cloudflare's analysis](https://blog.cloudflare.com/emudhra-certificate-compromise/) for its observations. Retain [Aikido's report](https://www.aikido.dev/blog/emudhra-ca-compromise) as another reference. Distinguish recoverable intermediate keys, root-store distrust and any independently evidenced certificate misuse. |

The editor's selections calibrate a broad newsroom: several incident and vulnerability stories, one explainer and one ecosystem-news item. Publication priority is decided per story group after the evidence gate, not by the number or recency of links in the issue.

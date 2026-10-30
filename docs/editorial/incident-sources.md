# Incident monitoring sources

Researched: 2026-10-30. Status: source catalogue and editorial recommendations; monitoring is not enabled by this document. The proposed workflow is in the [incident publication design](../superpowers/specs/2026-10-30-tsd-incident-publication-design.md).

## Editorial scope

Cover compromised packages and releases, CI/CD and publishing compromises, malicious dependencies, major dependency/runtime vulnerabilities, and certificate-trust incidents. These need different labels: a vulnerable runtime does not establish that its software distribution was compromised, and a public proof of concept does not establish exploitation in the wild. A CVE is optional for incident coverage.

The editor selected scheduled discovery with on-demand Codex drafting, followed by an Approve review that automatically merges and deploys after validation. Monitoring collects leads; it does not declare them confirmed or publish them.

## Recommended sources

Source authority attaches to a claim and its author, not just a domain. A maintainer statement supports the maintainer's account; a researcher's own analysis supports that analysis. A blog's aggregation, an unaffiliated issue, or a mailing-list message remains a discovery lead even when hosted on a project's domain. Preserve contradictions and subsequent corrections.

| Source | Why monitor it | Collection route and editorial use |
| --- | --- | --- |
| [Affected project security channels](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), including [PHP](https://www.php.net/) and [LiteLLM](https://docs.litellm.ai/blog) | Maintainer statements, affected releases, remediation, investigation updates | Project feeds below; allowlisted repository advisories and releases. Check the author and organization. Primary evidence for the project's stated scope and response. |
| [PyPI Blog](https://blog.pypi.org/) | Registry security changes, operational incidents, package publishing context | Created and updated RSS feeds below. A registry blog is not a complete log of malicious packages. |
| [Socket](https://socket.dev/blog) | npm/PyPI malware, compromised maintainers, credential theft, developing supply-chain campaigns | Public blog index, with bounded HTML collection. Filter research/news from product marketing; distinguish original findings from reporting. No feed was confirmed in this pass. |
| [StepSecurity Threat Intel](https://www.stepsecurity.io/threat-intel) | GitHub Actions compromises, release pipeline attacks, affected artifacts, indicators and response guidance | Threat-intelligence index and linked reports. Its October coverage includes LiteLLM and eMudhra. No feed was confirmed in this pass. |
| [Aikido research](https://www.aikido.dev/blog) | Dependency/runtime threats, package malware, Node2Shell coverage | Verified RSS below. Filter original research and incident reporting from product announcements. |
| [Wiz research](https://www.wiz.io/blog) | Original cloud and supply-chain research; PHP2Shell discovery | Public blog index and original reports. No feed was confirmed in this pass. |
| [Datadog Security Labs](https://securitylabs.datadoghq.com/) | Technical reproductions, cloud/CI exposure, malicious packages, detection context | Public index and reports. It has separate October LiteLLM, PHP2Shell, and Node2Shell coverage. No feed was confirmed in this pass. |
| [ReversingLabs research](https://www.reversinglabs.com/blog) | Malicious packages, binary and extension analysis, supply-chain campaigns | Public research posts. Use incident-specific reports rather than treating annual marketing statistics as incident evidence. No feed was confirmed in this pass. |
| [Microsoft Security Blog](https://www.microsoft.com/en-us/security/blog/) | Incident investigations, credential theft and downstream impact | Verified RSS below. Read research claims in their stated telemetry and customer scope. |
| [Cloudflare Blog](https://blog.cloudflare.com/) | Internet infrastructure incidents, mitigation observations and certificate trust | Verified RSS below. Useful for observed behavior and platform-specific response; not a substitute for upstream fixed-version authority. |
| [Mozilla Security Blog](https://blog.mozilla.org/security/) | Browser/root-store decisions and certificate revocation response | Verified RSS below. Essential for eMudhra-like incidents that may have no ordinary package CVE. Add allowlisted root-program incident records when investigating a specific lead. |
| [GitHub Advisory Database](https://github.com/github/advisory-database) | Structured vulnerability and malware advisory leads | Repository deltas and documented advisory interfaces. [GitHub documents malware search as `type:malware`](https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/github-advisory-database). Do not require a CVE or assume an advisory is a complete incident report. |
| [OpenSSF Malicious Packages](https://github.com/ossf/malicious-packages) | Structured reports across package ecosystems, including account takeover and dependency confusion | Git/JSON deltas in OSV format. Preserve report IDs, references, modified dates and withdrawals. Its README explicitly discusses false positives and borderline entries: a record alone is not enough to assert a confirmed attack. |
| [CERT-In advisories](https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02) and [CISA advisories](https://www.cisa.gov/cybersecurity-advisories) | Government advisories, coordination and corroboration; CERT-In covered the October LiteLLM compromise | Public advisory pages and documented feeds when verified. The specific CERT-In LiteLLM advisory was readable; the CISA advisory index returned HTTP 403 in this environment. Keep CISA KEV collection separate from this discovery stream. |

Start with the feeds, Socket, StepSecurity, Wiz, Datadog, and the two structured datasets. Add other HTML adapters after their pagination, terms and failure behavior are verified. Secondary press and social discussions can nominate leads, but publication should return to original evidence. There is no need to purchase a vendor's monitoring product to read its public reporting.

## Verified feed endpoints

All ten returned HTTP 200 and parsed as RSS or Atom at `2026-10-30T05:35:33Z`. This proves endpoint accessibility and format at that time, not complete historical coverage, timeliness or scheduled collector behavior. Entry counts describe these responses only.

| Source | Endpoint | Format | Entries observed |
| --- | --- | --- | ---: |
| Aikido | <https://www.aikido.dev/blog/rss.xml> | RSS | 100 |
| Cloudflare | <https://blog.cloudflare.com/rss/> | RSS | 20 |
| Mozilla Security | <https://blog.mozilla.org/security/feed/> | RSS | 10 |
| PyPI newly published posts | <https://blog.pypi.org/feed_rss_created.xml> | RSS | 20 |
| PyPI changed posts | <https://blog.pypi.org/feed_rss_updated.xml> | RSS | 20 |
| Node.js blog | <https://nodejs.org/en/feed/blog.xml> | RSS | 1,068 |
| PHP releases | <https://www.php.net/releases/feed.php> | Atom | 4 |
| PHP news | <https://www.php.net/feed.atom> | Atom | 892 |
| LiteLLM blog | <https://docs.litellm.ai/blog/rss.xml> | RSS | 154 |
| Microsoft Security | <https://www.microsoft.com/en-us/security/blog/feed/> | RSS | 10 |

Prefer canonical story URLs and source identifiers over feed position. Watch changed posts as well as new ones. Node.js/PHP feeds include routine releases; collection does not imply editorial selection. Fetch at bounded intervals with conditional requests where supported, allowlisted destinations, size limits and per-source checkpoints. Never treat the age of the newest post as proof that a feed fetch failed.

Local verification evidence: `/private/tmp/tsd-incident-source-research/feed-checks.json` and the corresponding downloaded XML responses. HTML-index inspection confirmed the sources listed above; no working feed is claimed for the HTML-only entries. A probe of the legacy Phylum blog failed certificate verification, so it is not included in the initial monitor set; do not disable TLS verification to add it.

## First reporting queue

These are researched leads, not approved stories. Each should become its own evidence packet and PR.

| Lead | Evidence to start from | Editorial distinction |
| --- | --- | --- |
| October LiteLLM release compromise | [Maintainer attack-chain report, published October 23](https://docs.litellm.ai/blog/security-incident-oct-21-2026-attack-chain); [CERT-In advisory](https://www.cert-in.org.in/s2cMainServlet?VLCODE=CIAD-2026-0053&pageid=PUBVLNOTES02); [Microsoft investigation](https://www.microsoft.com/en-us/security/blog/2026/10/23/inside-the-litellm-1-107-0-supply-chain-compromise-credential-theft-through-python-startup-hooks/) | The October 21 `1.107.0` compromise is separate from [the March incident](https://docs.litellm.ai/blog/security-update-march-2026). Do not merge their versions, timelines or attribution. The October maintainer report explicitly corrects earlier investigation assumptions; retain that correction history. |
| Node2Shell / Brotli | [Node.js October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases); [Datadog research index](https://securitylabs.datadoghq.com/) | A dependency/runtime vulnerability. Separate vendor severity, demonstrated exploit conditions and confirmed exploitation; do not describe a distribution compromise without evidence. |
| PHP2Shell | [PHP Foundation statement](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/); [Wiz original research](https://www.wiz.io/blog/php2shell-php-rce) | Core runtime vulnerability coverage. Derive affected/fixed versions from upstream guidance, and attribute exploitation claims to the organization observing them. |
| eMudhra / emSign trust incident | [eMudhra's evolving incident statement](https://emudhra.com/en/post/certificate-security-incident/); [Mozilla's response](https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/); [Cloudflare analysis](https://blog.cloudflare.com/emudhra-certificate-compromise/) | Certificate-trust incident. Keep weak intermediate keys, root distrust, browser protections and non-browser trust stores distinct. The issuing CA's account is one source, not an automatic resolution of conflicting claims. |

## What a summary PR should contain

- A short original headline and roughly 300–600 words explaining what happened, who should investigate, the supported impact, immediate actions and remaining unknowns.
- A concise UTC timeline where supported, with occurrence, disclosure, source update and TSD publication times kept separate.
- Source links and claim-level evidence for versions, artifacts, indicators, attribution and exploitation claims. Unknown fields stay `null`; no minimum number of sources replaces assessing their authority and independence.
- A rendered preview of the actual candidate, its evidence packet, validation results, proposed placement and the exact revision being reviewed.
- Explicit generated-copy status until real review occurs. Record the approving GitHub identity and reviewed revision through the publisher; the drafter cannot mark its own content reviewed.

Do not install or execute implicated packages, run copied exploit code, fetch attacker infrastructure, or copy third-party illustrations as part of ordinary reporting. Indicators can be recorded as inert evidence. Reader requests never supply arbitrary fetch targets to a server.

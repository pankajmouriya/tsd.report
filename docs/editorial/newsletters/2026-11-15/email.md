> Unapproved editorial draft — not published or sent.

# The Security Diff — 2026\-11\-15

CI credentials, trusted releases and forgotten cloud access: three incidents, three patch briefings and one agent\-security research note\.

## Lead story

### [wfx\-loot turns stolen GitHub access into CI credential theft](https://www.aikido.dev/blog/compromised-github-accounts-push-ci-secret-stealer-to-tens-of-thousands-of-repositories)

Supply Chain

Aikido reports stolen GitHub credentials were used to inject secret\-stealing workflows and install hooks into repositories from November 10\. Probe pull requests do not prove every repository executed the payload; deleted run logs can hide execution\. Action: Audit suspicious branches, workflow history and OIDC changes\. If the payload ran, treat workflow\-accessible credentials as exposed and investigate persistence before restoring trust\.

### [Malicious bee\-js and Swarm Desktop releases abuse a trusted release path](https://socket.dev/blog/bee-js-compromise)

Supply Chain

Socket and SafeDep report malicious @ethersphere/bee\-js 13\.3\.0 and Swarm Desktop 0\.56\.2 releases delivering remote\-code loaders\. The npm package carried valid provenance; affected systems need compromise assessment, not just a package downgrade\. Action: Check install and launcher history\. Isolate affected systems, rotate exposed credentials from a clean machine, and follow the researchers’ wallet\-key and persistence\-removal guidance\.

### [Qubole\-linked credentials expose forgotten AWS integration roles](https://www.wiz.io/blog/qubole-cross-account-access-abused-in-the-wild)

Supply Chain

Wiz and Sentra’s November 9 disclosures describe attackers using Qubole\-associated AWS credentials to assume customer integration roles, collect secrets and access S3 data\. Wiz dates the observed activity to October 14–26; this is a new disclosure of older activity\. Action: Inventory and remove unused vendor trusts\. Review unusual role assumptions and S3 object reads, limit integration\-role permissions, and investigate exposed secrets\.

### [Apache HTTP/2 flaw makes exposure checks and patching urgent](https://httpd.apache.org/security/vulnerabilities_24.html)

Vulnerabilities

Apache identifies CVE\-2026\-119618 in mod\_http2, affecting HTTP Server 2\.4\.55 through 2\.4\.70\. The fix shipped in 2\.4\.71 on November 11\. This is a disclosed RCE vulnerability; Aikido reported no known in\-the\-wild exploitation as of November 13\. Action: Apply Apache 2\.4\.71 or a vendor\-confirmed backport\. If patching must wait, review disabling HTTP/2 and verify that the backend no longer accepts it\.

### [MongoDB catch\-up flaw reaches replica sets before authentication](https://www.mongodb.com/community/forums/t/important-mongodb-security-update-available-action-required-november-10-2026/344843)

Vulnerabilities

MongoDB disclosed CVE\-2026\-118383 on November 10\. The replication use\-after\-free affects replica set members, including shard and config\-server members; standalone instances are outside its scope\. Datadog reproduced a crash, while the advisory also describes possible code execution\. Action: Upgrade every affected replica set member to its branch’s fixed release\. Datadog lists 8\.0\.37 for the 8\.0 branch; restrict network access while completing the rollout\.

### [Node\.js security updates address HTTP/2 crashes and memory disclosure](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)

Vulnerabilities

The Node\.js November 11 security release fixes HTTP/2 denial\-of\-service and memory\-disclosure issues, an HTTPS parser re\-entrancy flaw, and other bugs\. The project provides 22\.23\.5, 24\.22\.3 and 26\.13\.1; affected release lines and trigger conditions vary by issue\. Action: Move to the security release for your supported Node\.js line, rebuild deployed images and check running versions\. Consult the upstream per\-issue scope before claiming a deployment is unaffected\.

### [Research: coding\-agent backdoors can survive ordinary evaluation](https://www.microsoft.com/en-us/security/blog/2026/11/12/trained-to-betray-how-post-training-supply-chain-attacks-hijack-coding-agents/)

Research

Microsoft’s November 12 research demonstrates poisoned fine\-tuning data and backdoored checkpoints causing coding agents to misuse tools\. These are controlled studies, not a disclosed customer breach\. Dataset governance, checkpoint provenance and tool permissions remain separate controls\. Action: Pin and review training inputs, evaluate the exact deployed agent configuration, and restrict tool permissions and credentials outside the model\.

Proposed dated edition after approval: https://tsd.report/2026/11/15 (not published).

Read the linked original reports for evidence and dates. This is a proposed editorial selection.

[Editorial policy](https://tsd.report/editorial-policy) · [Privacy](https://tsd.report/privacy) · [RSS feed](https://tsd.report/rss.xml)

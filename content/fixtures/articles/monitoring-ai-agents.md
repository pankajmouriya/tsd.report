---
story_id: agent-boundaries
slug: agent-tool-boundaries
title: "Agent tool boundaries belong in the architecture, not only in the prompt"
structure: essay
status: unreviewed-fixture
credit: Editorial prototype
fixture: true
references:
  - id: nist-zero-trust
    name: NIST SP 800-207, Zero Trust Architecture
    url: https://csrc.nist.gov/pubs/sp/800/207/final
    published_at: 2020-08-11
    retrieved_at: 2026-09-27
    supports: Policy enforcement, least privilege, and continuous observation belong outside the requesting subject.
  - id: nist-least-privilege
    name: NIST least privilege glossary
    url: https://csrc.nist.gov/glossary/term/least_privilege
    retrieved_at: 2026-09-27
    supports: An entity should receive only the resources and authorizations needed for its function.
related_story_ids:
  - cve-priority
  - research-note
---

Imagine a coding agent asked to update one dependency and open a pull request. The request sounds narrow. The available tools may not be. A shell can read unrelated files, a package manager can run installation hooks, a repository credential can alter more than one branch, and a browser session may already hold access to internal systems. The sentence given to the model describes intent; the surrounding runtime decides what the action can actually reach.

That distinction is the foundation of an agent security design. A prompt can tell a model to stay inside a directory or avoid production. It cannot revoke a credential, constrain a network route, or make an unsafe tool implementation enforce an approval. The control has to exist at the point where the action crosses into another system.

## Instructions describe; capabilities enforce

An instruction is useful context. It helps the model choose an action and gives reviewers a basis for judging that choice. It is still data processed by the same system that may misunderstand the task, follow conflicting content, or construct an argument nobody anticipated.

A capability is different. It is a bounded ability presented by the runtime: read this repository, write this workspace, call this API with this identity, or request an approval for this exact operation. Least privilege describes the target state: each entity receives only the resources and authorizations it needs for its function.[^nist-least-privilege]

<aside class="evidence-note" aria-label="Source note: least privilege">
  <p><strong>NIST · retrieved Sep 27, 2026</strong></p>
  <p>Supports the least-privilege definition used in this section.</p>
  <p><a href="https://csrc.nist.gov/glossary/term/least_privilege">Open source</a></p>
</aside>

The practical test is simple: if the model ignores every instruction, what can the surrounding system still prevent? A read-only filesystem mount can prevent writes. A short-lived token scoped to one repository can reduce credential reach. An egress policy can deny an unrelated destination. A server-side authorization check can reject an operation whose target changed after approval.

## Map the tools before writing the policy

Start with a capability map, not a list of reassuring prompt rules. For each tool, record the resource it reaches, the identity it uses, the operations it exposes, and the evidence it emits. The map often reveals that a seemingly small function inherits authority from a much larger process.

<figure class="article-figure article-figure--wide">
  <svg viewBox="0 0 900 290" role="img" aria-labelledby="agent-boundary-title agent-boundary-desc">
    <title id="agent-boundary-title">An agent request crossing three enforceable capability boundaries</title>
    <desc id="agent-boundary-desc">A request passes through an approval record, a scoped tool gateway, and a resource policy before reaching a repository, shell, or external API. Each boundary produces an audit event.</desc>
    <g class="figure-box"><rect x="24" y="92" width="170" height="96"/><text x="109" y="132">AGENT REQUEST</text><text x="109" y="158">intent + arguments</text></g>
    <g class="figure-box"><rect x="255" y="52" width="170" height="176"/><text x="340" y="98">APPROVAL</text><text x="340" y="124">exact action</text><text x="340" y="150">target + expiry</text><text x="340" y="176">approver identity</text></g>
    <g class="figure-box"><rect x="486" y="52" width="170" height="176"/><text x="571" y="98">TOOL GATEWAY</text><text x="571" y="124">schema</text><text x="571" y="150">credential scope</text><text x="571" y="176">network policy</text></g>
    <g class="figure-box"><rect x="717" y="92" width="160" height="96"/><text x="797" y="132">RESOURCE</text><text x="797" y="158">independent check</text></g>
    <path class="figure-arrow" d="M194 140h53m178 0h53m178 0h53"/>
  </svg>
  <figcaption>Illustrative architecture, not a tested implementation. Authority narrows at each boundary, and every transition should be observable.</figcaption>
</figure>

The map should include indirect effects. A command that appears to edit a lockfile may invoke a package manager, execute scripts, read environment variables, and contact registries. A source-control tool may use a credential helper outside the workspace. A browser tool may inherit cookies from a human session. The unit of review is the entire action path, not the friendly name shown to the model.

## Bind approval to the operation

Human approval is meaningful only when the approved object is the object that executes. “Allow git” is too broad. “Allow this patch to update these files in this repository at this revision” is reviewable. If the target, arguments, identity, or relevant resource version changes, the prior approval should no longer authorize execution.

An illustrative policy can be small:

```json
{
  "tool": "repository.apply_patch",
  "repository": "example/service",
  "base_revision": "4f2c…",
  "paths": ["package.json", "package-lock.json"],
  "expires_in_seconds": 300
}
```

This example does not define a complete authorization protocol. A real system must canonicalize inputs, protect the approval record from replay or substitution, authenticate the executing identity, and decide what happens when the repository changes between review and execution. The point is that the runtime can compare a concrete operation with a concrete authorization instead of asking the model whether it still believes the action is allowed.

NIST's zero trust model separates policy decisions from policy enforcement and calls for monitoring of resource access and system activity.[^nist-zero-trust] Agent tooling is not identical to an enterprise zero trust deployment, but the separation is useful: the component proposing an action should not be the only component deciding and enforcing its authority.

<aside class="evidence-note" aria-label="Source note: policy enforcement">
  <p><strong>NIST SP 800-207 · Aug 11, 2020</strong></p>
  <p>Supports separate policy decision and enforcement plus continuous observation.</p>
  <p><a href="https://csrc.nist.gov/pubs/sp/800/207/final">Open source</a></p>
</aside>

## Record evidence that answers an investigation

Logs should make it possible to reconstruct what the system believed and what actually happened. Record the task or request identifier, tool name and version, normalized arguments, policy decision, approval identity, credential identity, resource response, and relevant timestamps. Preserve links between an action and its child processes or downstream calls.

Avoid treating raw transcript storage as sufficient telemetry. A transcript can show what the model said, while omitting the effective environment, credential scope, redirects, subprocesses, or the final resource decision. Conversely, indiscriminate capture can collect secrets and unrelated user data. The event design needs explicit fields, retention, redaction, and access controls.

Useful evidence also includes denials. Rejected destinations, expired approvals, scope mismatches, and attempted access outside the workspace show whether a boundary is active. A system that records only successful tool calls hides the moments that best explain its control posture.

## Failure modes to test deliberately

Test the architecture with boring counterexamples before relying on it. Change a file path after approval. Resolve an allowed hostname to a different destination. Trigger a package installation hook. Reuse an approval after its target revision changes. Start a child process that outlives the parent request. Ask a read tool to follow a symbolic link outside the workspace.

The expected result is not always denial. Some operations need a narrower reapproval, an isolated environment, or a different tool. What matters is that the behavior follows an explicit policy and produces evidence an investigator can interpret.

The model can also be unavailable, confused, or compromised without the control plane failing open. Tool gateways should validate inputs and authorization independently. Credentials should expire or be revoked independently. Resource systems should still apply their own permissions. Monitoring should distinguish “the model requested” from “the platform allowed” and “the resource completed.”

## Design questions before deployment

Before connecting an agent to a new tool, ask what resource is exposed, which identity will be used, how narrowly that identity can be scoped, and where enforcement occurs. Ask whether approval binds to exact arguments, how changes invalidate it, which network paths are reachable, and whether the resource performs an independent authorization check.

Then ask what evidence remains after the session ends. Can an investigator connect the request, approval, policy decision, credential, process, network call, and resource response? Can sensitive fields be redacted without erasing the decision? Can the same evidence explain a denial?

This preview does not claim that one gateway pattern makes an agent safe. Sandboxing, authorization, credential isolation, network controls, resource-side checks, and monitoring solve different parts of the problem. Their value comes from remaining independent when the model produces the wrong action. The prompt still matters, but it should guide behavior inside an architecture that can enforce its boundaries.

[^nist-zero-trust]: [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final), published August 11, 2020; retrieved September 27, 2026. Supports the separation of policy decision and enforcement plus continuous monitoring.

[^nist-least-privilege]: [NIST least privilege glossary](https://csrc.nist.gov/glossary/term/least_privilege), retrieved September 27, 2026. Supports the definition of least privilege used here.

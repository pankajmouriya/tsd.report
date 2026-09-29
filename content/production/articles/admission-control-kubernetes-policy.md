---
story_id: kubernetes-admission-control
slug: admission-control-kubernetes-policy
title: "Admission control is where Kubernetes policy becomes executable"
structure: essay
status: published
reviewed_by: Pankaj Mouriya
reviewed_at: 2026-09-29T16:19:11Z
credit: Pankaj Mouriya · Editor original
references:
  - id: noshellaccess-admission-controllers
    name: Quick Guide on Kubernetes Admission Controllers
    url: https://noshellaccess.com/containersecurity/guide-admission-controllers/
    published_at: 2024-04-12
    retrieved_at: 2026-09-29
    supports: The original explanation and examples that this essay revisits and updates.
  - id: kubernetes-admission-control
    name: Kubernetes documentation — Admission Control
    url: https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/
    retrieved_at: 2026-09-29
    supports: Request ordering, admission phases, extension points, and the scope of admission control.
  - id: kubernetes-dynamic-admission
    name: Kubernetes documentation — Dynamic Admission Control
    url: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/
    retrieved_at: 2026-09-29
    supports: Webhook ordering, timeouts, failure policy, reinvocation, matching, audit data, and metrics.
  - id: kubernetes-validating-admission-policy
    name: Kubernetes documentation — Validating Admission Policy
    url: https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/
    retrieved_at: 2026-09-29
    supports: Stable declarative in-process validation using CEL.
  - id: kubernetes-pod-security-admission
    name: Kubernetes documentation — Pod Security Admission
    url: https://kubernetes.io/docs/concepts/security/pod-security-admission/
    retrieved_at: 2026-09-29
    supports: Namespace-level Pod Security Standards enforcement, audit and warning modes, and version pinning.
related_story_ids: []
---

In 2024, I wrote a short guide to Kubernetes admission controllers around a simple gap: RBAC can decide whether a caller may create a Pod, but that decision does not say whether the Pod is safe to run. A caller can be authorized to create workloads and still submit an image from an unapproved registry, request privileged execution, mount a host path, or omit the controls a platform team expects.

That original guide introduced the request path, mutating and validating controllers, Pod Security Admission, and admission webhooks.[^noshellaccess-admission-controllers] The core model still holds. The more useful question now is how to turn that model into a policy boundary that engineers can operate without making the Kubernetes API fragile.

Admission control is the point where an authenticated, authorized request becomes a concrete object the cluster may persist. It is where a general permission such as “this identity may create Pods” can meet object-specific policy such as “this Pod must not run privileged.”

## Put admission in the correct place in the request path

The API server authenticates the caller and authorizes the requested operation before admission runs. Admission controllers then inspect requests that create, update, delete, or connect to resources before the object is persisted. Read operations such as `get`, `list`, and `watch` bypass the admission layer.[^kubernetes-admission-control]

That ordering creates three different questions:

1. **Authentication:** who is making the request?
2. **Authorization:** may that identity perform this verb on this resource?
3. **Admission:** is this particular object acceptable, and should it be changed before storage?

Treating these as interchangeable leaves gaps. Tight RBAC cannot express every property of an object. Admission cannot repair an identity system or replace authorization. Each boundary answers a different part of the decision.

<figure class="article-figure article-figure--wide">
  <svg viewBox="0 0 960 290" role="img" aria-labelledby="admission-path-title admission-path-desc">
    <title id="admission-path-title">A Kubernetes write request passing through identity, permission, mutation, and validation checks</title>
    <desc id="admission-path-desc">A write request reaches authentication, then authorization, then mutating admission, then validating admission. Accepted objects are persisted; rejected objects return an error. Read requests do not pass through admission.</desc>
    <g class="figure-box"><rect x="18" y="84" width="150" height="104"/><text x="93" y="126">API REQUEST</text><text x="93" y="153">create · update</text></g>
    <g class="figure-box"><rect x="208" y="84" width="150" height="104"/><text x="283" y="126">IDENTITY</text><text x="283" y="153">authenticate</text></g>
    <g class="figure-box"><rect x="398" y="84" width="150" height="104"/><text x="473" y="126">PERMISSION</text><text x="473" y="153">authorize</text></g>
    <g class="figure-box figure-step--accent"><rect x="588" y="50" width="164" height="172"/><text x="670" y="98">ADMISSION</text><text x="670" y="128">mutate first</text><text x="670" y="154">validate final</text><text x="670" y="180">allow or reject</text></g>
    <g class="figure-box"><rect x="792" y="84" width="150" height="104"/><text x="867" y="126">PERSIST</text><text x="867" y="153">accepted object</text></g>
    <path class="figure-arrow" d="M168 136h32m158 0h32m158 0h32m172 0h32"/>
  </svg>
  <figcaption>Admission evaluates writes after authentication and authorization and before persistence. Read requests bypass admission.</figcaption>
</figure>

## Mutation should create predictable defaults

Mutating admission runs before validating admission. It can add or change fields in the submitted object; validation then evaluates the resulting object.[^kubernetes-admission-control] A built-in example is `DefaultStorageClass`, which can add a default class to a PersistentVolumeClaim that did not request one. A custom mutating webhook might add an approved sidecar or standard metadata.

Useful mutation reduces repetitive configuration while producing an object the caller can understand. Surprising mutation does the opposite. If a platform silently adds network dependencies, changes resource requirements, or rewrites security settings, the deployed object can drift far from what the engineer reviewed.

Keep mutation small, deterministic, and idempotent. Kubernetes can reinvoke a mutating webhook when later plugins change an object, and the number or order of additional invocations is not a contract an implementation should depend on.[^kubernetes-dynamic-admission] The same input state should converge on the same result even when the mutation is evaluated again.

When a change is required for safety, ask whether rejecting the object with a precise message would be clearer than rewriting it. Defaults work well for low-surprise platform conventions. Security intent often deserves an explicit validation failure that the workload owner can see and fix.

## Validation should explain the rejected contract

Validating admission does not modify the request. It accepts or rejects the final object after mutation. That makes it the natural boundary for invariants: prohibit privileged containers, restrict host namespace access, require an allowed image registry, or ensure a workload carries ownership metadata.

The rejection is part of the developer experience. “Denied by policy” forces the caller to reverse-engineer the rule. A useful response names the field, the violated condition, and the supported remedy. Policy authors should test error messages with the same care as the condition itself.

Validation also needs a rollout path. Begin with observation where the mechanism allows it, measure which workloads would fail, identify legitimate exceptions, and only then enforce. A rule that is technically correct but immediately blocks critical controllers will be bypassed under pressure.

## Start with built-in Pod Security Admission

For Pod security, begin with the built-in Pod Security Admission controller before building a custom webhook. It applies the Kubernetes Pod Security Standards at namespace level and supports `enforce`, `audit`, and `warn` modes. Namespaces can choose `privileged`, `baseline`, or `restricted`, and can pin each mode to a Kubernetes minor version rather than follow `latest` automatically.[^kubernetes-pod-security-admission]

A staged namespace policy might look like this:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: payments
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/enforce-version: v1.37
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: v1.37
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: v1.37
```

This example enforces the baseline profile while exposing restricted-profile violations through warnings and audit annotations. The version labels make the evaluated contract explicit. Before using it, replace the example version with a supported version for the actual cluster and test controller-created Pods, not only direct Pod submissions.

Pod Security Admission applies enforcement to Pod creation. For workload resources such as Deployments and Jobs, warning and audit checks help surface issues earlier, while enforcement occurs when the controller creates the resulting Pods.[^kubernetes-pod-security-admission] That distinction matters when testing a rollout.

## Prefer in-process validation when CEL can express the rule

Validating Admission Policy became stable in Kubernetes 1.30. It provides declarative, in-process validation using the Common Expression Language, or CEL.[^kubernetes-validating-admission-policy] For rules that depend only on the admission request and declared parameters, this removes an external network call from the API write path.

That changes the default design question. Before deploying a validating webhook, ask whether a built-in controller or a `ValidatingAdmissionPolicy` can express the invariant. In-process policy avoids operating a TLS endpoint, service discovery, availability, scaling, and version compatibility for a component that every matching API request may need.

A webhook remains appropriate when the decision genuinely needs behavior the in-process policy mechanism cannot provide, such as carefully bounded external context. Even then, avoid turning admission into a general integration bus. Every dependency placed in the request path becomes part of control-plane availability.

## Treat webhooks as control-plane dependencies

An admission webhook is an HTTP callback invoked by the API server. Mutating webhooks run before validating webhooks; a validating webhook that must enforce policy sees the object after mutation is complete.[^kubernetes-dynamic-admission] This flexibility carries operational cost.

Scope webhooks narrowly by operation, resource, namespace, object, and match conditions. Exclude the webhook's own dependencies and recovery paths where appropriate so a broken policy service does not prevent its repair. Keep timeouts short; Kubernetes permits configurable timeouts and documents a default of ten seconds, which is far too much latency to spend casually on every matching write.[^kubernetes-dynamic-admission]

Choose `failurePolicy` from the consequence, not from a universal slogan. `Fail` rejects matching requests when the webhook times out or cannot be reached. `Ignore` allows the request to continue. A fail-closed policy protects an invariant but can block the API when its service fails. A fail-open policy preserves availability but needs audit or later reconciliation if the missed decision matters. Record the choice and test the failure, including DNS, TLS, network, malformed response, and timeout conditions.

Monitor latency and rejections from the API server's admission metrics, and retain audit data that shows which mutating webhook changed an object.[^kubernetes-dynamic-admission] A policy boundary that cannot explain its mutations, denials, and outages is difficult to trust.

## Roll policy out as a product

An admission rule has users, compatibility constraints, failure modes, and a release process. Give each rule an owner. Version its behavior. Test it against representative manifests and controllers. Publish the reason and remediation. Define the exception mechanism and its expiry. Observe latency, timeouts, denials, and bypasses.

Use a progression that makes impact visible:

1. Define the invariant and the evidence it protects.
2. Select the least operationally expensive mechanism: built-in controller, in-process policy, then webhook when required.
3. Evaluate existing objects and new requests without enforcement where possible.
4. Fix common violations and document narrow exceptions.
5. Enforce on a limited scope, exercise dependency failures, and expand gradually.
6. Recheck the policy on Kubernetes upgrades and when API versions change.

The essential distinction from the original guide remains useful: RBAC controls who may ask, while admission controls which requested object may enter the cluster. The mature implementation adds another principle: the policy engine itself is production infrastructure. Keep its decisions understandable, its dependencies bounded, and its failure behavior deliberate.

[^noshellaccess-admission-controllers]: [Quick Guide on Kubernetes Admission Controllers](https://noshellaccess.com/containersecurity/guide-admission-controllers/), published April 12, 2024; retrieved September 29, 2026. This essay revisits and substantially expands that earlier explanation.

[^kubernetes-admission-control]: [Admission Control in Kubernetes](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/), retrieved September 29, 2026. Supports admission ordering, phases, extension points, and request scope.

[^kubernetes-dynamic-admission]: [Dynamic Admission Control](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/), retrieved September 29, 2026. Supports webhook ordering, matching, timeouts, failure policy, reinvocation, audit data, and metrics.

[^kubernetes-validating-admission-policy]: [Validating Admission Policy](https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/), retrieved September 29, 2026. Supports stable in-process validation with CEL since Kubernetes 1.30.

[^kubernetes-pod-security-admission]: [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/), retrieved September 29, 2026. Supports namespace policy modes, levels, version labels, and workload behavior.

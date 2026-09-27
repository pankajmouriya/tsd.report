# Homepage composition study

This directory contains two standalone newspaper compositions generated from the same validated fixture edition. They are selection artifacts, not application routes.

## Generate

```sh
node design-explorations/homepage-compositions/generate.mjs
```

## Review locally

```sh
python3 -m http.server 4322 --directory design-explorations/homepage-compositions
```

- Balanced newspaper: `http://localhost:4322/composition-a.html`
- Dense newspaper: `http://localhost:4322/composition-b.html`
- Add `?theme=dark` for the dark treatment.

Review at 1440px and 390px. The topic controls are intentionally static in these concept files. Application integration happens only after a composition is selected.

## Capture the comparison

With the local server running, create the review matrix and overflow report:

```sh
node design-explorations/homepage-compositions/capture.mjs
```

Evidence is written to `/private/tmp/tsd-homepage-compositions/` so browser captures and machine-specific output do not enter the product repository.

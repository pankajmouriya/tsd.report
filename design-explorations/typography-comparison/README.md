# Typography comparison

Generate the comparison from the validated edition fixture:

```sh
node design-explorations/typography-comparison/generate.mjs
python3 -m http.server 4322 --directory design-explorations/typography-comparison
```

Open `http://localhost:4322/comparison.html`. Font and theme selections are reflected in the URL.

The local fonts and licenses are experiment-only. The application continues to use Georgia until a candidate is selected.

Capture the 12-view comparison and measurement report with:

```sh
node design-explorations/typography-comparison/capture.mjs
```

Evidence is written to `/private/tmp/tsd-typography-comparison/`.

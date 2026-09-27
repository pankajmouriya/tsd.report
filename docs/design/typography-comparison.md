# Typography Comparison

Date: 2026-09-27
Status: Newsreader selected and integrated locally; no deployment performed

## Purpose

The homepage composition is stable enough to evaluate typography independently. The current Georgia stack is readable and carries no font payload, but the masthead, lead, section headings, and story headlines share a similar heavy-bold texture. This experiment tests whether a different type system creates clearer hierarchy and a more distinctive editorial voice without changing content, layout, color, or metadata typography.

## Options

| Option | Purpose | Local assets |
| --- | --- | --- |
| Retuned Georgia | Establish whether adjusted weight, tracking, and scale are enough | System font; 0 KB |
| Source Serif 4 | Primary candidate for a cohesive display and reading system with optical-size-specific designs | Display Semibold, Small Text Regular, Italic; 223.8 KB |
| Newsreader | Editorial alternative designed for sustained reading on screens | 72pt Semibold, 16pt Regular, 16pt Italic; 146.2 KB |

The system sans stack remains unchanged for controls, labels, metadata, and table headings.

## Source and licensing

- [Source Serif](https://github.com/adobe-fonts/source-serif) is an Adobe open-source family. The experiment uses WOFF2 files from the official repository and includes its license at `design-explorations/typography-comparison/fonts/source-serif-4/LICENSE.md`.
- [Newsreader](https://github.com/productiontype/Newsreader) is designed by Production Type for continuous on-screen reading and is distributed under SIL Open Font License 1.1. The experiment includes the upstream license at `design-explorations/typography-comparison/fonts/newsreader/OFL.txt`.

The original comparison files remain isolated to the experiment. The selected production subsets and license are recorded under `public/fonts/`.

## Controlled comparison

Hold these properties constant:

- Edition content and wording
- Page width, columns, and spacing
- Colors, rules, and illustration treatment
- System sans metadata
- Desktop and mobile viewports
- Light and dark themes

Tune these properties for each family:

- Display weight
- Headline tracking
- Headline line height
- Body face and line height
- Italic tagline

## Surfaces

The comparison page renders:

1. The Security Diff masthead and tagline
2. The long “Patching the edge” lead headline
3. Three representative Security Briefs
4. The “A critical CVE count” article title, summary, and body excerpt
5. A compact Vulnerability Watch row with technical identifiers and numerals

Review each option at 1440px and 390px in light and dark themes.

## Selection criteria

- Masthead authority without excessive visual weight
- Clear distinction among lead, section, and story headlines
- Natural wrapping of long security headlines
- Comfortable body texture and line tracking
- Legible italic tagline
- Stable technical identifiers and numerals
- Coherent dark-theme weight
- No layout shift or horizontal overflow
- Total production font payload within the 250 KB project budget, preferably below 200 KB

Adopt a new family only if it visibly improves editorial identity or sustained reading. Georgia remains the fallback and zero-payload baseline.

## Experiment

The standalone experiment is under `design-explorations/typography-comparison/`. Generate it from fixture content with:

```sh
node design-explorations/typography-comparison/generate.mjs
```

Serve that directory locally and open `comparison.html`. Use the Font and Theme controls or the `?font=georgia|source|newsreader&theme=light|dark` query parameters.

Capture the full matrix and its measurements with:

```sh
node design-explorations/typography-comparison/capture.mjs
```

The capture script writes twelve screenshots and `report.json` to `/private/tmp/tsd-typography-comparison/`.

## Results

The experiment rendered all three options at 390px and 1440px in light and dark themes. All twelve views loaded their intended fonts and had no page-level horizontal overflow.

| Option | Mobile lead | Desktop lead | Font resources | Encoded font bytes | Visual result |
| --- | ---: | ---: | ---: | ---: | --- |
| Retuned Georgia | 5 lines | 2 lines | 0 | 0 | Strong newspaper authority, but display and body text retain a uniformly heavy texture. |
| Source Serif 4 | 4 lines | 3 lines | 3 | 223,832 | Refined and comfortable for prose, but the lead loses urgency and occupies an extra desktop line. |
| Newsreader | 4 lines | 2 lines | 3 | 149,616 | Keeps the compact lead, distinguishes display text from body copy, and remains coherent in dark mode. |

Line counts were identical between light and dark themes for each family. Source Serif 4 stays within the 250 KB project ceiling but exceeds the preferred 200 KB target. Newsreader is 74,216 bytes lighter and remains below the preferred target.

## Decision

**Newsreader** was selected and integrated into the local application, with Georgia as the fallback. It provides the clearest visible improvement without changing the page composition: long headlines retain compact wrapping and article copy is calmer than the previous Georgia texture. It also has the strongest payload result among the downloaded families.

This recommendation changes the initial preference for Source Serif 4. The rendered comparison showed that Source Serif 4 works better as a literary reading face than as the primary voice of this compact security newspaper at the current measure and scale.

The publication nameplate was subsequently separated from the editorial type system. It now uses a seven-glyph, locally hosted subset of **Grenze Gotisch Bold**, an open-source modern blackletter by Omnibus Type. The face appears only in “The Security Diff”; Newsreader remains responsible for every story headline, section title, and reading surface. This creates a recognizable newspaper signature without spreading decorative letterforms through the interface.

## Production integration evidence

- Five Newsreader WOFF2 subsets cover 72pt display medium and semibold plus 16pt regular, semibold, and italic. One 6,584-byte Grenze Gotisch subset covers the fixed nameplate text.
- The full installed payload is 226,872 bytes. The homepage loads 179,680 bytes because it does not need the body semibold face; an article using emphasis loads 190,092 bytes because it does not need the lead-only medium face.
- The nameplate and Newsreader display faces are preloaded; every face uses `font-display: swap` and a serif fallback.
- Browser captures cover the homepage at 390px, 720px, and 1440px and the canonical article route at 390px and 1440px in both themes.
- Measured cumulative layout shift ranged from 0.00049 to 0.05145, below the 0.1 good-experience threshold used for this review.
- Every measured view loaded the intended display and text families and had no page-level horizontal overflow.
- Evidence is stored under `/private/tmp/tsd-production-typography/` with `report.json` and seven screenshots.

The production implementation scores 10/10 on the Web Typography diagnostic: body size, measure, leading, hierarchy, real-size review, payload, fallbacks, 200% reflow, balanced headings, and link distinction all pass. The lead alone uses weight 500 after the blackletter nameplate made its previous semibold weight feel unnecessarily dense; other editorial headings remain semibold.

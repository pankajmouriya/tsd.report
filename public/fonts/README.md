# Web fonts

## Newsreader

The application uses five static Newsreader faces from the official Production Type repository at commit `cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155`:

- `Newsreader72pt-Medium.ttf` for lead headlines
- `Newsreader72pt-SemiBold.ttf` for section, card, and article headlines
- `Newsreader16pt-Regular.ttf` for body copy
- `Newsreader16pt-SemiBold.ttf` for emphasized body copy
- `Newsreader16pt-Italic.ttf` for italic body copy and the tagline

The files were subset with FontTools 4.66.0 and Brotli to WOFF2. The retained ranges are Latin and Latin Extended, General Punctuation, currency symbols, letterlike symbols, and arrows:

```text
U+0000-024F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF
```

The five files total 220,288 bytes. `Newsreader-OFL.txt` is the upstream SIL Open Font License 1.1.

SHA-256 checksums:

```text
5df81aae365e545e2d6103b945672c8ea33c58fe09984bc94046c615c699d9b9  newsreader-display-semibold.woff2
1f2364bcd90b47367e0e8720b6efc9da51938590fdea0114a557134462eb60ca  newsreader-text-italic.woff2
43cd370a8ba82c6e713194b5eb048431ba7359cd13a49f3fe8cbd35f378f5825  newsreader-display-medium.woff2
1de455b3ee4167a9d3a01ad2828240a7136d79fa00881dfc34b9160eb5771805  newsreader-text-regular.woff2
f7b5ec735cfd0aa15561519c075e4f598d58877ed6cfb95a80d64c907fc989b4  newsreader-text-semibold.woff2
```

## Grenze Gotisch masthead

The masthead uses the official Grenze Gotisch Bold source from the Omnibus Type repository at commit `7b5eac166bc3b2a519f98b5c124cb7a11670cc7b`. It is used only for the publication name; Newsreader remains the editorial headline and reading family.

The production WOFF2 contains only the glyphs required by “The Security Diff” and is 6,584 bytes. It was generated with FontTools 4.66.0. `Grenze-Gotisch-OFL.txt` is the upstream SIL Open Font License 1.1.

```text
14c875649bf195bfe0e00b75bd25490928a174ea2dd248e1a14228cb0caf7878  grenze-gotisch-masthead-bold.woff2
```

The complete production font payload is 226,872 bytes.

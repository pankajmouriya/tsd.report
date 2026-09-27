import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const edition = JSON.parse(await readFile(new URL('data/fixtures/editions/2026-09-26.json', root), 'utf8'));
const byId = (id) => edition.stories.find((story) => story.id === id);
const lead = byId(edition.lead_story);
const briefs = ['signed-builds', 'admission-guardrails', 'epss-explained'].map(byId);
const article = byId('cve-priority');
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const story = (item) => `<article class="story"><p class="kicker">${esc(item.type)} · ${esc(item.category.replaceAll('-', ' '))}</p><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><p class="meta">Source: ${esc(item.sources[0].name)} · Sep 26, 2026</p></article>`;

const html = `<!doctype html>
<html lang="en" data-font="georgia" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <meta name="theme-color" content="#faf6e9" />
  <title>Typography comparison · The Security Diff</title>
  <link rel="stylesheet" href="./comparison.css" />
</head>
<body>
  <a class="skip" href="#specimen">Skip to specimen</a>
  <header class="lab-bar">
    <div><strong>Typography study</strong><span>Identical content and layout</span></div>
    <div class="control-group" role="group" aria-label="Typeface"><span>Font</span><button data-font-choice="georgia" aria-pressed="true">Georgia</button><button data-font-choice="source" aria-pressed="false">Source Serif 4</button><button data-font-choice="newsreader" aria-pressed="false">Newsreader</button></div>
    <div class="control-group" role="group" aria-label="Theme"><span>Theme</span><button data-theme-choice="light" aria-pressed="true">Light</button><button data-theme-choice="dark" aria-pressed="false">Dark</button></div>
  </header>
  <main class="sheet" id="specimen">
    <section class="masthead-block">
      <p class="edition-meta">Saturday, September 26, 2026 · 15 stories</p>
      <h1>The Security Diff</h1>
      <p class="tagline">Security engineering, without the noise.</p>
    </section>
    <section class="lead">
      <p class="kicker">Lead story · Vulnerabilities</p>
      <h2>${esc(lead.title)}</h2>
      <p class="byline">Source: ${esc(lead.sources[0].name)} · Sep 26, 2026</p>
      <p class="lead-summary">${esc(lead.summary)}</p>
    </section>
    <section class="briefs">
      <header class="section-heading"><p class="section-label">Daily report</p><h2>Today’s Security Briefs</h2></header>
      <div class="story-grid">${briefs.map(story).join('')}</div>
    </section>
    <section class="article-sample">
      <div class="article-copy">
        <p class="section-label">Original · Vulnerabilities</p>
        <h2>${esc(article.title)}</h2>
        <p class="dek">${esc(article.summary)}</p>
        <p>${esc(article.body[0])}</p>
        <p>${esc(article.why_it_matters)} ${esc(article.action)}</p>
      </div>
      <aside class="type-notes">
        <p class="section-label">Current specimen</p>
        <dl><div><dt>Family</dt><dd data-family>Georgia</dd></div><div><dt>Display weight</dt><dd data-weight>700</dd></div><div><dt>Local payload</dt><dd data-payload>0 KB</dd></div><div><dt>Loaded this view</dt><dd data-loaded>0 KB</dd></div></dl>
      </aside>
    </section>
    <section class="watch">
      <p class="section-label">Evidence desk</p><h2>Vulnerability Watch</h2>
      <table><thead><tr><th>CVE</th><th>CVSS</th><th>EPSS</th><th>KEV</th><th>Technology</th></tr></thead><tbody><tr><td translate="no">CVE-2021-44228</td><td>10.0</td><td>Not available</td><td>Yes</td><td>Apache Log4j 2</td></tr></tbody></table>
    </section>
    <footer><p>Fixture content for typography evaluation.</p><p>Georgia remains the production baseline.</p></footer>
  </main>
  <script>
    const options = {
      georgia: { family: 'Georgia', weight: '700', payload: '0 KB' },
      source: { family: 'Source Serif 4', weight: '600', payload: '223.8 KB' },
      newsreader: { family: 'Newsreader', weight: '600', payload: '146.2 KB' },
    };
    const params = new URLSearchParams(location.search);
    const font = options[params.get('font')] ? params.get('font') : 'georgia';
    const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    const apply = () => {
      document.documentElement.dataset.font = font;
      document.documentElement.dataset.theme = theme;
      document.querySelectorAll('[data-font-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.fontChoice === font)));
      document.querySelectorAll('[data-theme-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
      document.querySelector('[data-family]').textContent = options[font].family;
      document.querySelector('[data-weight]').textContent = options[font].weight;
      document.querySelector('[data-payload]').textContent = options[font].payload;
      document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#1d1c18' : '#faf6e9';
    };
    const navigate = (key, value) => { const next = new URL(location.href); next.searchParams.set(key, value); location.href = next; };
    document.querySelectorAll('[data-font-choice]').forEach((button) => button.addEventListener('click', () => navigate('font', button.dataset.fontChoice)));
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => navigate('theme', button.dataset.themeChoice)));
    apply();
    document.fonts.ready.then(() => {
      const bytes = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/fonts/')).reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0);
      document.querySelector('[data-loaded]').textContent = font === 'georgia' ? '0 KB' : bytes ? (bytes / 1024).toFixed(1) + ' KB' : 'cached';
    });
  </script>
</body>
</html>`;

await writeFile(new URL('design-explorations/typography-comparison/comparison.html', root), html);
console.log('Generated typography comparison from the 2026-09-26 fixture.');

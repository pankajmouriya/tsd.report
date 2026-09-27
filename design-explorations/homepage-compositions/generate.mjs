import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const edition = JSON.parse(await readFile(new URL('data/fixtures/editions/2026-09-26.json', root), 'utf8'));

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const labels = {
  vulnerabilities: 'Vulnerabilities',
  'supply-chain': 'Supply Chain',
  'ai-security': 'AI & Agent Security',
  appsec: 'AppSec',
  cloud: 'Cloud & Kubernetes',
  research: 'Research',
  'security-engineering': 'Security Engineering',
};

const formatDate = (value, style = 'long') => new Intl.DateTimeFormat('en-US', style === 'long'
  ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
).format(new Date(value));

const lead = edition.stories.find((story) => story.id === edition.lead_story);
const ordered = edition.sections.briefs.map((id) => edition.stories.find((story) => story.id === id)).filter(Boolean);
const originals = ordered.filter((story) => story.type === 'original');
const research = ordered.filter((story) => story.type === 'research' || story.category === 'research');
const reports = ordered.filter((story) => !originals.includes(story) && !research.includes(story));

function meta(story) {
  const source = story.sources?.[0]?.name;
  const credit = story.author ? `By ${story.author}` : source ? `Source: ${source}` : '';
  return `${escapeHtml(credit)}${credit ? '<span aria-hidden="true"> · </span>' : ''}<time datetime="${escapeHtml(story.published_at)}">${formatDate(story.published_at, 'short')}</time>`;
}

function storyCard(story, variant = '') {
  return `<article class="story ${variant}" data-story-id="${escapeHtml(story.id)}">
    <p class="story-kicker">${escapeHtml(story.type)} <span aria-hidden="true">·</span> ${escapeHtml(labels[story.category] ?? story.category)}</p>
    <h3><a href="/article/${escapeHtml(story.slug)}">${escapeHtml(story.title)}</a></h3>
    <p class="story-summary">${escapeHtml(story.summary)}</p>
    ${variant === 'story--substantial' ? `<p class="story-context"><strong>Why it matters</strong> ${escapeHtml(story.why_it_matters)}</p>` : ''}
    <p class="story-meta">${meta(story)}</p>
  </article>`;
}

function leadArtwork() {
  return `<figure class="lead-art">
    <svg viewBox="0 0 820 520" role="img" aria-labelledby="evidence-title evidence-description">
      <title id="evidence-title">Evidence path for prioritizing a vulnerable component</title>
      <desc id="evidence-description">A four-stage decision path checks whether a component is deployed, reachable, exploited, and covered by vendor guidance before action.</desc>
      <rect class="art-ground" x="1" y="1" width="818" height="518" />
      <text class="art-overline" x="52" y="59">PATCH DECISION / EVIDENCE PATH</text>
      <text class="art-title" x="52" y="110">What changed?</text>
      <path class="art-spine" d="M126 185 H694" />
      <g transform="translate(62 148)">
        <circle class="art-node" cx="64" cy="38" r="25" />
        <text class="art-number" x="64" y="45">01</text>
        <text class="art-label" x="0" y="102">DEPLOYED</text>
        <text class="art-note" x="0" y="129">component + version</text>
      </g>
      <g transform="translate(250 148)">
        <circle class="art-node" cx="64" cy="38" r="25" />
        <text class="art-number" x="64" y="45">02</text>
        <text class="art-label" x="0" y="102">REACHABLE</text>
        <text class="art-note" x="0" y="129">path + exposure</text>
      </g>
      <g transform="translate(438 148)">
        <circle class="art-node art-node--accent" cx="64" cy="38" r="25" />
        <text class="art-number art-number--accent" x="64" y="45">03</text>
        <text class="art-label" x="0" y="102">EXPLOITED</text>
        <text class="art-note" x="0" y="129">dated evidence</text>
      </g>
      <g transform="translate(626 148)">
        <circle class="art-node" cx="64" cy="38" r="25" />
        <text class="art-number" x="64" y="45">04</text>
        <text class="art-label" x="0" y="102">ACTION</text>
        <text class="art-note" x="0" y="129">vendor guidance</text>
      </g>
      <line class="art-divider" x1="52" y1="332" x2="768" y2="332" />
      <text class="art-caption-label" x="52" y="376">SUPPORTED PRIORITY</text>
      <text class="art-caption" x="52" y="420">Reachability + exploitation evidence</text>
      <text class="art-caption" x="52" y="454">before emergency change.</text>
      <path class="art-arrow" d="M656 414 h94 m-20 -20 20 20 -20 20" />
    </svg>
    <figcaption>Decision sequence shown for the fixture brief; verify current vendor evidence before acting.</figcaption>
  </figure>`;
}

function filters() {
  return `<section class="filters" aria-label="Static filter concept">
    <div class="filter-line"><span class="filter-name">Topic</span><div class="filter-options">
      <button class="filter-option is-active" type="button" aria-pressed="true">All</button>
      ${Object.values(labels).map((label) => `<button class="filter-option" type="button" aria-pressed="false">${escapeHtml(label)}</button>`).join('')}
    </div></div>
    <div class="filter-line filter-line--signal"><span class="filter-name">Signal</span><div class="filter-options">
      <button class="filter-option is-active" type="button" aria-pressed="true">All</button>
      <button class="filter-option" type="button" aria-pressed="false">Recommended</button>
      <button class="filter-option" type="button" aria-pressed="false">Must Read</button>
    </div><span class="filter-status">Showing all ${edition.stories.length} stories</span></div>
  </section>`;
}

function leadStory() {
  return `<article class="lead-story">
    <p class="lead-kicker">Lead story <span aria-hidden="true">·</span> ${escapeHtml(labels[lead.category])}</p>
    <h2><a href="/article/${escapeHtml(lead.slug)}">${escapeHtml(lead.title)}</a></h2>
    <p class="lead-meta">${meta(lead)}</p>
    <div class="lead-layout">
      ${leadArtwork()}
      <div class="lead-copy">
        <p class="lead-summary">${escapeHtml(lead.summary)}</p>
        <dl class="evidence-notes">
          <div><dt>Why it matters</dt><dd>${escapeHtml(lead.why_it_matters)}</dd></div>
          <div><dt>Affected</dt><dd>${escapeHtml(lead.affected_technologies.join(' · '))}</dd></div>
          <div><dt>Supported action</dt><dd>${escapeHtml(lead.action)}</dd></div>
          <div><dt>Evidence</dt><dd>${escapeHtml(lead.sources[0].name)} · Retrieved ${formatDate(lead.sources[0].retrieved_at, 'short')}</dd></div>
        </dl>
      </div>
    </div>
  </article>`;
}

function vulnerabilityWatch() {
  const rows = edition.stories.flatMap((story) => story.vulnerabilities.map((vulnerability) => ({ story, vulnerability })));
  return `<section class="watch section-block" aria-labelledby="watch-heading">
    <header class="section-heading"><div><p class="section-index">Evidence desk</p><h2 id="watch-heading">Vulnerability Watch</h2></div><p>Snapshot · ${formatDate(edition.date, 'short')}</p></header>
    <div class="watch-scroll" tabindex="0"><table><thead><tr><th>CVE</th><th>CVSS</th><th>EPSS</th><th>KEV</th><th>Technology</th><th>Supported action</th></tr></thead><tbody>
      ${rows.map(({ story, vulnerability }) => `<tr><td><a href="/cve/${escapeHtml(vulnerability.cve)}" translate="no">${escapeHtml(vulnerability.cve)}</a></td><td>${vulnerability.cvss ?? 'Unknown'}</td><td>${vulnerability.epss == null ? 'Not available' : `${Math.round(vulnerability.epss * 100)}%`}</td><td>${vulnerability.kev == null ? 'Unknown' : vulnerability.kev ? 'Yes' : 'No'}</td><td>${escapeHtml(vulnerability.affected.join(', ') || 'Not available')}</td><td>${escapeHtml(story.action)}</td></tr>`).join('')}
    </tbody></table></div>
  </section>`;
}

function featureSection(title, index, stories, className) {
  return `<section class="section-block ${className}" aria-labelledby="${className}-heading">
    <header class="section-heading"><div><p class="section-index">${index}</p><h2 id="${className}-heading">${title}</h2></div><p>${stories.length} ${stories.length === 1 ? 'story' : 'stories'}</p></header>
    <div class="feature-grid">${stories.map((story, i) => storyCard(story, i === 0 ? 'story--feature' : '')).join('')}</div>
  </section>`;
}

function themeScript() {
  return `<script>
    const root = document.documentElement;
    const params = new URLSearchParams(location.search);
    root.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    const button = document.querySelector('[data-theme-toggle]');
    const themeColor = document.querySelector('[data-theme-color]');
    const sync = () => {
      button.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Use light theme' : 'Use dark theme');
      themeColor.setAttribute('content', root.dataset.theme === 'dark' ? '#1d1c18' : '#faf6e9');
    };
    sync();
    button.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; sync(); });
  </script>`;
}

function page(composition) {
  const name = composition === 'a' ? 'Balanced newspaper' : 'Dense newspaper';
  return `<!doctype html>
<html lang="en" data-theme="light" data-composition="${composition}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <meta name="theme-color" content="#faf6e9" data-theme-color />
  <title>${name} concept · The Security Diff</title>
  <link rel="stylesheet" href="./concept.css" />
</head>
<body>
  <a class="skip-link" href="#main">Skip to edition</a>
  <div class="fixture-banner">Fixture preview <span aria-hidden="true">·</span> Composition ${composition.toUpperCase()} <span aria-hidden="true">·</span> ${name}</div>
  <div class="sheet">
    <header class="edition-header">
      <div class="utility-row"><a href="/archive">← Archive</a><span class="publication-mark">TSD.report</span><nav aria-label="Edition date"><a href="#" aria-label="Previous edition">‹</a><time datetime="${edition.date}">${formatDate(edition.date)}</time><a href="#" aria-label="Next edition">›</a></nav><span>${edition.stories.length} stories</span><button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark theme"><span aria-hidden="true">◐</span></button></div>
      <h1 class="masthead"><a href="/">The Security Diff</a></h1>
      <p class="tagline">Security engineering, without the noise.</p>
      <div class="double-rule" aria-hidden="true"></div>
    </header>
    ${filters()}
    <main id="main">
      ${leadStory()}
      <section class="coverage section-block" aria-labelledby="coverage-heading">
        <header class="section-heading"><div><p class="section-index">Daily report</p><h2 id="coverage-heading">Today’s Security Briefs</h2></div><p>Selected for engineering relevance</p></header>
        <div class="story-grid">${reports.map((story, index) => storyCard(story, index < 3 ? 'story--substantial' : '')).join('')}</div>
      </section>
      ${vulnerabilityWatch()}
      ${featureSection('From the Editor', 'Original writing', originals, 'originals')}
      ${featureSection('Research Worth Reading', 'Research notes', research, 'research')}
    </main>
    <nav class="edition-nav" aria-label="Edition navigation"><a href="#">← Friday, September 25</a><a href="/archive">Browse the archive</a></nav>
    <footer><p>The Security Diff · Fixture content for design evaluation.</p><nav aria-label="Publication links"><a href="/about">About</a><a href="/editorial-policy">Editorial policy</a><a href="/rss.xml">RSS</a><a href="/feed.json">JSON</a></nav></footer>
  </div>
  ${themeScript()}
</body>
</html>`;
}

await Promise.all([
  writeFile(new URL('design-explorations/homepage-compositions/composition-a.html', root), page('a')),
  writeFile(new URL('design-explorations/homepage-compositions/composition-b.html', root), page('b')),
]);

console.log('Generated composition-a.html and composition-b.html from 2026-09-26 fixture data.');

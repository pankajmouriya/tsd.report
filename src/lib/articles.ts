export type MarkdownArticle = {
  title: string;
  slug: string;
  paragraphs: string[];
};

export function parseMarkdownArticle(raw: string): MarkdownArticle {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.trim());
  if (!match) throw new Error('Article frontmatter is required');
  const fields = Object.fromEntries(match[1].split('\n').map((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) return [line, ''];
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, '')];
  }));
  if (!fields.title || !fields.slug) throw new Error('Article title and slug are required');
  return {
    title: fields.title,
    slug: fields.slug,
    paragraphs: match[2].trim().split(/\n\s*\n/).map((paragraph) => paragraph.replaceAll('\n', ' ').trim()).filter(Boolean),
  };
}

const rawArticles = import.meta.glob('../../content/articles/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const articles = Object.values(rawArticles).map(parseMarkdownArticle);

export function findMarkdownArticle(slug: string): MarkdownArticle | undefined {
  return articles.find((article) => article.slug === slug);
}

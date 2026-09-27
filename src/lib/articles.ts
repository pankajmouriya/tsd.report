export type ArticleReference = {
  id: string;
  name: string;
  url: string;
  retrieved_at: string;
};

export type ArticleDocument = {
  id: string;
  body: string;
  data: {
    story_id: string;
    slug: string;
    title: string;
    structure: 'essay' | 'brief';
    status: 'unreviewed-fixture' | 'reviewed-fixture';
    fixture: true;
    references: ArticleReference[];
    related_story_ids: string[];
  };
};

type StoryIdentity = { id: string; slug: string; title: string; fixture: boolean };

export function validateArticleDocuments<T extends ArticleDocument>(documents: T[], stories: StoryIdentity[]): T[] {
  const slugs = new Set<string>();
  const storyIds = new Set<string>();

  for (const document of documents) {
    if (slugs.has(document.data.slug)) throw new Error(`Duplicate article slug: ${document.data.slug}`);
    if (storyIds.has(document.data.story_id)) throw new Error(`Duplicate article story id: ${document.data.story_id}`);
    slugs.add(document.data.slug);
    storyIds.add(document.data.story_id);

    const story = stories.find((candidate) => candidate.id === document.data.story_id);
    if (!story) throw new Error(`Unknown story id: ${document.data.story_id}`);
    if (story.slug !== document.data.slug) throw new Error(`Article slug does not match story ${story.id}`);
    if (story.title !== document.data.title) throw new Error(`Article title does not match story ${story.id}`);
    if (!story.fixture || !document.data.fixture) throw new Error(`Article fixture status does not match story ${story.id}`);

    const references = new Set<string>();
    for (const reference of document.data.references) {
      if (references.has(reference.id)) throw new Error(`Duplicate reference id: ${reference.id}`);
      references.add(reference.id);
      const url = new URL(reference.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`Unsafe reference URL: ${reference.url}`);
    }

    const citations = [...document.body.matchAll(/\[\^([a-z0-9-]+)\]/gi)].map((match) => match[1]);
    for (const citation of citations) if (!references.has(citation)) throw new Error(`Missing reference: ${citation}`);
    for (const reference of references) if (!citations.includes(reference)) throw new Error(`Unused reference: ${reference}`);
  }

  return documents;
}

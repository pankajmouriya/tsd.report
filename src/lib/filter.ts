import { categories, type Category, type Story } from './schema';

export type StoryFilters = {
  topic: Category | 'all';
  signal: 'all' | 'recommended' | 'must-read';
};

const topicValues = new Set<string>(['all', ...categories]);
const signalValues = new Set<string>(['all', 'recommended', 'must-read']);

export function parseStoryFilters(params: URLSearchParams): StoryFilters {
  const topic = params.get('topic') ?? 'all';
  const signal = params.get('signal') ?? 'all';

  return {
    topic: topicValues.has(topic) ? topic as StoryFilters['topic'] : 'all',
    signal: signalValues.has(signal) ? signal as StoryFilters['signal'] : 'all',
  };
}

export function filterStories(stories: Story[], filters: StoryFilters): Story[] {
  return stories.filter((story) => {
    const topicMatches = filters.topic === 'all' || story.category === filters.topic;
    const signalMatches = filters.signal === 'all'
      || story.signal.label === filters.signal
      || (filters.signal === 'recommended' && story.signal.label === 'must-read');
    return topicMatches && signalMatches;
  });
}

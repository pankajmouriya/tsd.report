import type { Category, Story } from './schema';

export type StoryFilters = {
  topic: Category | 'all';
  signal: 'all' | 'recommended' | 'must-read';
};

export function filterStories(stories: Story[], filters: StoryFilters): Story[] {
  return stories.filter((story) => {
    const topicMatches = filters.topic === 'all' || story.category === filters.topic;
    const signalMatches = filters.signal === 'all'
      || story.signal.label === filters.signal
      || (filters.signal === 'recommended' && story.signal.label === 'must-read');
    return topicMatches && signalMatches;
  });
}

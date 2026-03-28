import { useAppStore } from '@/store';
import type { User, Content } from '@/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'u-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    bio: '',
    role: 'listener',
    preferences: {
      defaultPlaybackSpeed: 1,
      autoPlayNext: true,
      emailNotifications: true,
      pushNotifications: false,
      preferredLanguage: 'ja',
    },
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    content_id: 'c-1',
    creator_id: 'u-1',
    creator_display_name: 'Creator',
    title: 'Test Content',
    slug: 'test-content',
    excerpt: 'excerpt',
    body_markdown: null,
    body_html: null,
    thumbnail_url: null,
    audio: {
      status: 'completed',
      audio_url: 'https://example.com/audio.mp3',
      duration_seconds: 300,
      file_size_bytes: 512000,
      format: 'mp3',
      tts_voice: null,
      tts_job_id: null,
    },
    category_ids: [],
    tags: [],
    series_id: null,
    pricing: { type: 'free', price_jpy: 0, currency: 'JPY' },
    stats: {
      view_count: 0,
      play_count: 0,
      completion_count: 0,
      purchase_count: 0,
      average_rating: 0,
      review_count: 0,
    },
    status: 'published',
    published_at: '2025-01-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useAppStore.setState({
      user: null,
      currentContent: null,
      isPlayerVisible: false,
      isSidebarOpen: false,
    });
  });

  it('has correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(state.currentContent).toBeNull();
    expect(state.isPlayerVisible).toBe(false);
    expect(state.isSidebarOpen).toBe(false);
  });

  it('setUser sets and clears the user', () => {
    const user = makeUser();
    useAppStore.getState().setUser(user);
    expect(useAppStore.getState().user).toEqual(user);

    useAppStore.getState().setUser(null);
    expect(useAppStore.getState().user).toBeNull();
  });

  it('setCurrentContent sets content and shows player', () => {
    const content = makeContent();
    useAppStore.getState().setCurrentContent(content);
    expect(useAppStore.getState().currentContent).toEqual(content);
    expect(useAppStore.getState().isPlayerVisible).toBe(true);
  });

  it('setCurrentContent with null hides player', () => {
    useAppStore.getState().setCurrentContent(makeContent());
    expect(useAppStore.getState().isPlayerVisible).toBe(true);

    useAppStore.getState().setCurrentContent(null);
    expect(useAppStore.getState().currentContent).toBeNull();
    expect(useAppStore.getState().isPlayerVisible).toBe(false);
  });

  it('toggleSidebar flips the sidebar state', () => {
    expect(useAppStore.getState().isSidebarOpen).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().isSidebarOpen).toBe(true);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().isSidebarOpen).toBe(false);
  });

  it('showPlayer and hidePlayer control player visibility', () => {
    expect(useAppStore.getState().isPlayerVisible).toBe(false);
    useAppStore.getState().showPlayer();
    expect(useAppStore.getState().isPlayerVisible).toBe(true);
    useAppStore.getState().hidePlayer();
    expect(useAppStore.getState().isPlayerVisible).toBe(false);
  });
});

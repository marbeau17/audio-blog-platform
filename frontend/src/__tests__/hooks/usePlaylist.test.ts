import { renderHook, act } from '@testing-library/react';
import { usePlaylist } from '@/hooks/usePlaylist';
import type { Content } from '@/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock zustand store
const mockSetCurrentContent = jest.fn();
jest.mock('@/store', () => ({
  useAppStore: (selector: (state: { setCurrentContent: typeof mockSetCurrentContent }) => unknown) =>
    selector({ setCurrentContent: mockSetCurrentContent }),
}));

function makeContent(id: string, title: string = `Track ${id}`): Content {
  return {
    content_id: id,
    creator_id: 'creator-1',
    creator_display_name: 'Creator',
    title,
    slug: `track-${id}`,
    excerpt: '',
    body_markdown: null,
    body_html: null,
    thumbnail_url: null,
    audio: {
      status: 'completed',
      audio_url: `https://example.com/${id}.mp3`,
      duration_seconds: 180,
      file_size_bytes: 1000000,
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
  };
}

describe('usePlaylist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('starts with an empty queue', () => {
    const { result } = renderHook(() => usePlaylist());
    expect(result.current.queue.tracks).toEqual([]);
    expect(result.current.queue.currentIndex).toBe(-1);
    expect(result.current.currentTrack).toBeNull();
  });

  it('adds a track to the queue', () => {
    const { result } = renderHook(() => usePlaylist());
    const track = makeContent('1');

    act(() => {
      result.current.addToQueue(track);
    });

    expect(result.current.queue.tracks).toHaveLength(1);
    expect(result.current.queue.tracks[0].content_id).toBe('1');
    expect(result.current.queue.currentIndex).toBe(0);
    // First track auto-plays
    expect(mockSetCurrentContent).toHaveBeenCalledWith(track);
  });

  it('does not add duplicate tracks', () => {
    const { result } = renderHook(() => usePlaylist());
    const track = makeContent('1');

    act(() => {
      result.current.addToQueue(track);
    });
    act(() => {
      result.current.addToQueue(track);
    });

    expect(result.current.queue.tracks).toHaveLength(1);
  });

  it('removes a track from the queue', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    act(() => {
      result.current.removeFromQueue('1');
    });

    expect(result.current.queue.tracks).toHaveLength(1);
    expect(result.current.queue.tracks[0].content_id).toBe('2');
  });

  it('clears the queue when last track is removed', () => {
    const { result } = renderHook(() => usePlaylist());
    const track = makeContent('1');

    act(() => {
      result.current.addToQueue(track);
    });
    act(() => {
      result.current.removeFromQueue('1');
    });

    expect(result.current.queue.tracks).toHaveLength(0);
    expect(result.current.queue.currentIndex).toBe(-1);
    expect(mockSetCurrentContent).toHaveBeenLastCalledWith(null);
  });

  it('plays the next track', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');
    const track3 = makeContent('3');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    act(() => {
      result.current.addToQueue(track3);
    });

    // currentIndex should be 0
    expect(result.current.queue.currentIndex).toBe(0);

    act(() => {
      result.current.playNext();
    });

    expect(result.current.queue.currentIndex).toBe(1);
    expect(mockSetCurrentContent).toHaveBeenCalledWith(track2);
  });

  it('does not advance past the last track when repeat is off', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    act(() => {
      result.current.playNext(); // go to index 1
    });
    act(() => {
      result.current.playNext(); // at last track, should stay
    });

    expect(result.current.queue.currentIndex).toBe(1);
  });

  it('plays the previous track', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    act(() => {
      result.current.playNext(); // go to index 1
    });
    act(() => {
      result.current.playPrevious();
    });

    expect(result.current.queue.currentIndex).toBe(0);
    expect(mockSetCurrentContent).toHaveBeenCalledWith(track1);
  });

  it('toggles shuffle mode', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });

    expect(result.current.queue.shuffle).toBe(false);

    act(() => {
      result.current.toggleShuffle();
    });

    expect(result.current.queue.shuffle).toBe(true);
    expect(result.current.queue.shuffledIndices.length).toBeGreaterThan(0);

    act(() => {
      result.current.toggleShuffle();
    });

    expect(result.current.queue.shuffle).toBe(false);
    expect(result.current.queue.shuffledIndices).toEqual([]);
  });

  it('cycles repeat modes: off -> all -> one -> off', () => {
    const { result } = renderHook(() => usePlaylist());

    expect(result.current.queue.repeat).toBe('off');

    act(() => {
      result.current.cycleRepeat();
    });
    expect(result.current.queue.repeat).toBe('all');

    act(() => {
      result.current.cycleRepeat();
    });
    expect(result.current.queue.repeat).toBe('one');

    act(() => {
      result.current.cycleRepeat();
    });
    expect(result.current.queue.repeat).toBe('off');
  });

  it('wraps around with repeat all mode', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    // Enable repeat all
    act(() => {
      result.current.cycleRepeat(); // off -> all
    });
    // Go to last track
    act(() => {
      result.current.playNext(); // index 1
    });
    // Next should wrap to 0
    act(() => {
      result.current.playNext();
    });

    expect(result.current.queue.currentIndex).toBe(0);
    expect(mockSetCurrentContent).toHaveBeenCalledWith(track1);
  });

  it('repeats same track with repeat one mode', () => {
    const { result } = renderHook(() => usePlaylist());
    const track1 = makeContent('1');
    const track2 = makeContent('2');

    act(() => {
      result.current.addToQueue(track1);
    });
    act(() => {
      result.current.addToQueue(track2);
    });
    // Enable repeat one: off -> all -> one
    act(() => {
      result.current.cycleRepeat();
    });
    act(() => {
      result.current.cycleRepeat();
    });
    expect(result.current.queue.repeat).toBe('one');

    act(() => {
      result.current.playNext();
    });

    // Should stay on current track (index 0)
    expect(result.current.queue.currentIndex).toBe(0);
  });

  it('clears the entire queue', () => {
    const { result } = renderHook(() => usePlaylist());

    act(() => {
      result.current.addToQueue(makeContent('1'));
    });
    act(() => {
      result.current.addToQueue(makeContent('2'));
    });
    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queue.tracks).toEqual([]);
    expect(result.current.queue.currentIndex).toBe(-1);
    expect(result.current.queue.shuffle).toBe(false);
    expect(result.current.queue.repeat).toBe('off');
    expect(mockSetCurrentContent).toHaveBeenLastCalledWith(null);
  });

  it('creates a playlist', () => {
    const { result } = renderHook(() => usePlaylist());

    let playlist: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      playlist = result.current.createPlaylist('My Playlist');
    });

    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].name).toBe('My Playlist');
    expect(result.current.playlists[0].tracks).toEqual([]);
    expect(result.current.playlists[0].id).toMatch(/^pl_/);
  });

  it('creates a playlist with initial tracks', () => {
    const { result } = renderHook(() => usePlaylist());
    const tracks = [makeContent('1'), makeContent('2')];

    act(() => {
      result.current.createPlaylist('Preset Playlist', tracks);
    });

    expect(result.current.playlists[0].tracks).toHaveLength(2);
  });

  it('deletes a playlist', () => {
    const { result } = renderHook(() => usePlaylist());

    let playlistId: string;
    act(() => {
      const pl = result.current.createPlaylist('To Delete');
      playlistId = pl.id;
    });

    expect(result.current.playlists).toHaveLength(1);

    act(() => {
      result.current.deletePlaylist(playlistId!);
    });

    expect(result.current.playlists).toHaveLength(0);
  });

  it('persists queue to localStorage', () => {
    const { result } = renderHook(() => usePlaylist());

    act(() => {
      result.current.addToQueue(makeContent('1'));
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'audio-blog-play-queue',
      expect.any(String),
    );
  });

  it('persists playlists to localStorage', () => {
    const { result } = renderHook(() => usePlaylist());

    act(() => {
      result.current.createPlaylist('Saved Playlist');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'audio-blog-playlists',
      expect.any(String),
    );
  });
});

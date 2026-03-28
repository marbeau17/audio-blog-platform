import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentCard from '@/components/content/ContentCard';
import type { Content } from '@/types';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock the store
const mockSetCurrentContent = jest.fn();
jest.mock('@/store', () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ setCurrentContent: mockSetCurrentContent }),
}));

function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    content_id: 'c-1',
    creator_id: 'u-1',
    creator_display_name: 'Test Creator',
    title: 'Test Content Title',
    slug: 'test-content-title',
    excerpt: 'A short excerpt',
    body_markdown: null,
    body_html: null,
    thumbnail_url: null,
    audio: {
      status: 'completed',
      audio_url: 'https://example.com/audio.mp3',
      duration_seconds: 600,
      file_size_bytes: 1024000,
      format: 'mp3',
      tts_voice: null,
      tts_job_id: null,
    },
    category_ids: [],
    tags: [],
    series_id: null,
    pricing: { type: 'free', price_jpy: 0, currency: 'JPY' },
    stats: {
      view_count: 100,
      play_count: 50,
      completion_count: 20,
      purchase_count: 0,
      average_rating: 4.5,
      review_count: 10,
    },
    status: 'published',
    published_at: '2025-01-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ContentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders content title and creator name', () => {
    render(<ContentCard content={makeContent()} />);
    expect(screen.getByText('Test Content Title')).toBeInTheDocument();
    expect(screen.getByText('Test Creator')).toBeInTheDocument();
  });

  it('renders price tag for paid content', () => {
    const content = makeContent({
      pricing: { type: 'paid', price_jpy: 500, currency: 'JPY' },
    });
    render(<ContentCard content={content} />);
    expect(screen.getByText('¥500')).toBeInTheDocument();
  });

  it('renders "Free" label for free content', () => {
    render(<ContentCard content={makeContent()} />);
    // The component renders Japanese "無料" for free
    expect(screen.getByText('無料')).toBeInTheDocument();
  });

  it('renders play count and rating', () => {
    render(<ContentCard content={makeContent()} />);
    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
  });

  it('links to the content page', () => {
    render(<ContentCard content={makeContent()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/content/c-1');
  });

  it('calls setCurrentContent when play button is clicked', () => {
    const content = makeContent();
    render(<ContentCard content={content} />);
    const buttons = screen.getAllByRole('button');
    // The play button is the last button in the overlay
    const playButton = buttons[buttons.length - 1];
    fireEvent.click(playButton);
    expect(mockSetCurrentContent).toHaveBeenCalledWith(content);
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SearchBar from '@/components/search/SearchBar';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: ({ className }: { className?: string }) => (
    <div data-testid="search-icon" className={className} />
  ),
  X: ({ className }: { className?: string }) => (
    <div data-testid="x-icon" className={className} />
  ),
}));

// Mock api
const mockApiGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

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

describe('SearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorageMock.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search input with placeholder', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders search icon', () => {
    render(<SearchBar />);
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('debounces input by 300ms before fetching suggestions', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        { type: 'content', id: '1', title: 'Test Result' },
      ],
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    // Type a query (minimum 2 chars to trigger suggestions)
    fireEvent.change(input, { target: { value: 'te' } });

    // API should not be called immediately
    expect(mockApiGet).not.toHaveBeenCalled();

    // Advance by 200ms - still should not be called
    jest.advanceTimersByTime(200);
    expect(mockApiGet).not.toHaveBeenCalled();

    // Advance to 300ms - now it should fire
    jest.advanceTimersByTime(100);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/search?q=te&limit=5');
  });

  it('shows suggestions after debounce completes', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        { type: 'content', id: '1', title: 'Test Podcast' },
        { type: 'creator', id: '2', title: 'Test Creator' },
      ],
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'test' } });

    // Trigger debounce
    jest.advanceTimersByTime(300);

    // Wait for async state updates
    await waitFor(() => {
      expect(screen.getByText('Test Podcast')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Creator')).toBeInTheDocument();
    expect(screen.getByText('コンテンツ')).toBeInTheDocument();
    expect(screen.getByText('クリエイター')).toBeInTheDocument();
  });

  it('does not fetch suggestions for queries shorter than 2 characters', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'a' } });
    jest.advanceTimersByTime(300);

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('navigates on form submit', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'podcast' } });
    fireEvent.submit(input);

    expect(mockPush).toHaveBeenCalledWith('/search?q=podcast');
  });

  it('does not navigate on empty submit', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.submit(input);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('encodes query parameter on navigate', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'hello world' } });
    fireEvent.submit(input);

    expect(mockPush).toHaveBeenCalledWith('/search?q=hello%20world');
  });

  it('saves search to recent searches on submit', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'my search' } });
    fireEvent.submit(input);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'audioblog_recent_searches',
      expect.stringContaining('my search'),
    );
  });

  it('resets debounce timer on rapid typing', () => {
    mockApiGet.mockResolvedValue({ data: [] });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('コンテンツやクリエイターを検索...');

    fireEvent.change(input, { target: { value: 'te' } });
    jest.advanceTimersByTime(200);

    // Type again before debounce fires
    fireEvent.change(input, { target: { value: 'tes' } });
    jest.advanceTimersByTime(200);

    // Original 300ms has passed since first keystroke but timer was reset
    expect(mockApiGet).not.toHaveBeenCalled();

    // Advance remaining 100ms for second debounce
    jest.advanceTimersByTime(100);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/search?q=tes&limit=5');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '@/components/layout/Header';
import type { User } from '@/types';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock SearchBar
jest.mock('@/components/search/SearchBar', () => {
  return function MockSearchBar() {
    return <div data-testid="search-bar" />;
  };
});

// Mock useAuth hook
const mockSignOut = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

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

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders logo', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: mockSignOut });
    render(<Header />);
    expect(screen.getByText('AudioBlog')).toBeInTheDocument();
  });

  it('shows login and register links when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: mockSignOut });
    render(<Header />);
    expect(screen.getByText('ログイン')).toBeInTheDocument();
    expect(screen.getByText('新規登録')).toBeInTheDocument();
  });

  it('shows user avatar button when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser(),
      loading: false,
      signOut: mockSignOut,
    });
    render(<Header />);
    // User initial is shown in the avatar
    expect(screen.getByText('T')).toBeInTheDocument();
    // Login/register should not be present
    expect(screen.queryByText('ログイン')).not.toBeInTheDocument();
    expect(screen.queryByText('新規登録')).not.toBeInTheDocument();
  });

  it('shows admin link for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'admin' }),
      loading: false,
      signOut: mockSignOut,
    });
    render(<Header />);
    expect(screen.getByText('管理者')).toBeInTheDocument();
  });

  it('does not show admin link for non-admin users', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'listener' }),
      loading: false,
      signOut: mockSignOut,
    });
    render(<Header />);
    expect(screen.queryByText('管理者')).not.toBeInTheDocument();
  });

  it('shows creator dashboard link for creators', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'creator' }),
      loading: false,
      signOut: mockSignOut,
    });
    render(<Header />);
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
  });

  it('shows creator dashboard link for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'admin' }),
      loading: false,
      signOut: mockSignOut,
    });
    render(<Header />);
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: mockSignOut });
    render(<Header />);
    // Should not show login or user elements while loading
    expect(screen.queryByText('ログイン')).not.toBeInTheDocument();
    expect(screen.queryByText('T')).not.toBeInTheDocument();
  });
});

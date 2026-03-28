import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import type { User } from '@/types';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock useAuth hook
const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader-icon" className={className} />
  ),
  ShieldAlert: ({ className }: { className?: string }) => (
    <div data-testid="shield-alert-icon" className={className} />
  ),
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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to custom path when redirectTo is specified', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <ProtectedRoute redirectTo="/custom-login">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(mockPush).toHaveBeenCalledWith('/custom-login');
  });

  it('shows access denied for wrong role', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'listener' }),
      loading: false,
    });
    render(
      <ProtectedRoute requiredRole="admin">
        <div>Admin Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument();
    expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
    expect(screen.getByText('ホームに戻る')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when authorized', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'listener' }),
      loading: false,
    });
    render(
      <ProtectedRoute requiredRole="listener">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('admin can access creator pages (role hierarchy)', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'admin' }),
      loading: false,
    });
    render(
      <ProtectedRoute requiredRole="creator">
        <div>Creator Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Creator Content')).toBeInTheDocument();
    expect(screen.queryByText('アクセス権限がありません')).not.toBeInTheDocument();
  });

  it('admin can access listener pages', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'admin' }),
      loading: false,
    });
    render(
      <ProtectedRoute requiredRole="listener">
        <div>Listener Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Listener Content')).toBeInTheDocument();
  });

  it('creator cannot access admin pages', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'creator' }),
      loading: false,
    });
    render(
      <ProtectedRoute requiredRole="admin">
        <div>Admin Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('defaults to listener role when no requiredRole is specified', () => {
    mockUseAuth.mockReturnValue({
      user: makeUser({ role: 'listener' }),
      loading: false,
    });
    render(
      <ProtectedRoute>
        <div>Default Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Default Content')).toBeInTheDocument();
  });
});

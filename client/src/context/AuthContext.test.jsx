import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axiosInstance from '../api/axiosInstance';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="email">{user?.email ?? 'none'}</p>
      <button onClick={() => login({
        _id: 'u1',
        name: 'Manual User',
        email: 'manual@test.local',
        role: 'shipper',
        isActive: true,
      })}
      >
        login
      </button>
      <button onClick={() => logout(() => {})}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
  });

  test('hydrates authenticated sessions from /api/auth/me', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: {
        data: {
          user: {
            _id: 'u1',
            name: 'Hydrated User',
            email: 'hydrated@test.local',
            role: 'admin',
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('email')).toHaveTextContent('hydrated@test.local');
  });

  test('sets unauthenticated state when hydration fails', async () => {
    axiosInstance.get.mockRejectedValueOnce(new Error('unauthorized'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  test('supports manual login state and clears state on logout', async () => {
    axiosInstance.get.mockRejectedValueOnce(new Error('unauthorized'));
    axiosInstance.post.mockResolvedValueOnce({});

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('email')).toHaveTextContent('manual@test.local');

    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('none');
    });
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/auth/logout');
  });
});

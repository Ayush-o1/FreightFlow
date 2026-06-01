import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth';

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/protected" element={<p>Protected content</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/unauthorized" element={<p>Unauthorized page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  test('renders a loading state while auth hydrates', () => {
    useAuth.mockReturnValue({ user: null, isLoading: true });
    renderRoute();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('redirects unauthenticated users to login', () => {
    useAuth.mockReturnValue({ user: null, isLoading: false });
    renderRoute();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  test('redirects authenticated users with the wrong role', () => {
    useAuth.mockReturnValue({
      user: { _id: 'u1', role: 'shipper' },
      isLoading: false,
    });
    renderRoute();

    expect(screen.getByText('Unauthorized page')).toBeInTheDocument();
  });

  test('renders nested content for allowed roles', () => {
    useAuth.mockReturnValue({
      user: { _id: 'u1', role: 'admin' },
      isLoading: false,
    });
    renderRoute();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});

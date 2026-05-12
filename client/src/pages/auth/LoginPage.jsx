/**
 * LoginPage.jsx
 * Full login implementation using the FreightFlow backend.
 *
 * Endpoint: POST /api/auth/login
 * Body:     { email, password }
 * Success:  response.data.data.token + response.data.data.user
 * Error:    response.data.message
 *
 * On success: calls login() from AuthContext, then redirects by role.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import axiosInstance from '../../api/axiosInstance';

// Role → dashboard path mapping
const ROLE_REDIRECT = {
  shipper: '/shipper/dashboard',
  driver:  '/driver/dashboard',
  admin:   '/admin/dashboard',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  // ── Client-side validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = { email: '', password: '' };
    let valid = true;

    if (!email.trim()) {
      errs.email = 'Email is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (!password) {
      errs.password = 'Password is required.';
      valid = false;
    }

    setFieldErrors(errs);
    return valid;
  };

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const response = await axiosInstance.post('/api/auth/login', {
        email:    email.trim().toLowerCase(),
        password,
      });

      const { token, user } = response.data.data;

      // Persist session and update context
      login(user, token);

      // Redirect based on role
      const destination = ROLE_REDIRECT[user.role] ?? '/login';
      navigate(destination, { replace: true });

    } catch (err) {
      const msg =
        err.response?.data?.message ??
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Sign in to your account
          </p>
        </div>

        {/* Global error banner */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
            disabled={loading}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={loading}
            fullWidth
          >
            Sign in
          </Button>
        </form>

        {/* Register link */}
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

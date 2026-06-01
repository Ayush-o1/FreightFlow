/**
 * RegisterPage.jsx
 * Full registration implementation using the FreightFlow backend.
 *
 * Endpoint: POST /api/auth/register
 * Body:     { name, email, password, role }
 * Success:  201 → response.data.data.user (token set as httpOnly cookie — not in body)
 *           Backend registers the user and sets auth cookies immediately.
 * Error:    response.data.message
 *
 * Role values accepted by backend: 'shipper' | 'driver' (lowercase).
 * Admin accounts cannot be self-registered.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import axiosInstance from '../../api/axiosInstance';

const ROLE_OPTIONS = [
  { label: 'Shipper — I need to ship freight', value: 'shipper' },
  { label: 'Driver — I deliver freight',        value: 'driver'  },
];

const ROLE_REDIRECT = {
  shipper: '/shipper/dashboard',
  driver:  '/driver/dashboard',
  admin:   '/admin/dashboard',
};

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [formData, setFormData] = useState({
    name:     '',
    email:    '',
    password: '',
    role:     '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  // ── Field change handler ───────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // ── Client-side validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    let valid = true;

    if (!formData.name.trim()) {
      errs.name = 'Full name is required.';
      valid = false;
    }

    if (!formData.email.trim()) {
      errs.email = 'Email is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (!formData.password) {
      errs.password = 'Password is required.';
      valid = false;
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
      valid = false;
    } else if (formData.password.length > 128) {
      errs.password = 'Password cannot exceed 128 characters.';
      valid = false;
    }

    if (!formData.role) {
      errs.role = 'Please select your role.';
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
      const response = await axiosInstance.post('/api/auth/register', {
        name:     formData.name.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
        role:     formData.role, // 'shipper' | 'driver' — matches backend enum
      });

      // Token is in httpOnly cookie — set state with user data only
      const { user } = response.data.data;
      login(user);

      const destination = ROLE_REDIRECT[user.role] ?? '/login';
      navigate(destination, { replace: true });

    } catch (err) {
      const msg =
        err.response?.data?.message ??
        'Registration failed. Please try again.';
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
            Create your account
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Join FreightFlow to get started
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
            label="Full name"
            name="name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            error={fieldErrors.name}
            required
            disabled={loading}
          />

          <Input
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            error={fieldErrors.email}
            required
            disabled={loading}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            error={fieldErrors.password}
            helperText="Must be 8–128 characters long."
            required
            disabled={loading}
          />

          <Select
            label="I am a…"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={ROLE_OPTIONS}
            placeholder="Select your role"
            error={fieldErrors.role}
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
            Create account
          </Button>
        </form>

        {/* Login link */}
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

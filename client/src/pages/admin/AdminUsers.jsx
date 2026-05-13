/**
 * AdminUsers.jsx
 * Complete user management page — list all users with role filter and search.
 *
 * Endpoint: GET /api/admin/users (?role=...)
 * No delete / role-change endpoints exist on the backend (confirmed from adminRoutes.js).
 * Actions column shows "—" accordingly.
 *
 * Clicking a row expands an inline detail panel showing all safe user fields.
 * Pagination: backend returns all users at once (no pagination params on getAllUsers).
 *   Shows "Showing all {count} users" text.
 */

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Users, ChevronRight } from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import EmptyState      from '../../components/ui/EmptyState';
import { getAllUsers }  from '../../api/adminApi';
import { formatDate }   from '../../utils/formatters';
import { getInitials }  from '../../utils/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeVariant(role) {
  return role === 'admin' ? 'danger' : role === 'driver' ? 'success' : 'info';
}

const ROLE_OPTIONS = [
  { label: 'All Roles', value: '' },
  { label: 'Shipper',   value: 'shipper' },
  { label: 'Driver',    value: 'driver' },
  { label: 'Admin',     value: 'admin' },
];

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--color-border)]" style={{ width: i === 1 ? '32px' : i === 6 ? '48px' : '100%' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Expanded detail row ───────────────────────────────────────────────────────
function UserDetailRow({ user }) {
  return (
    <tr className="bg-[var(--color-bg)]">
      <td colSpan={6} className="px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
              User ID
            </p>
            <p className="font-mono text-xs text-[var(--color-text-primary)] break-all">{user._id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
              Account Status
            </p>
            <Badge
              label={user.isActive ? 'Active' : 'Inactive'}
              variant={user.isActive ? 'success' : 'danger'}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
              Last Updated
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">{formatDate(user.updatedAt)}</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [search,     setSearch]     = useState('');
  const [expanded,   setExpanded]   = useState(null); // _id of expanded row

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAllUsers();
      setUsers(res.data?.data?.users ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Client-side filter: role + search
  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter) result = result.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, roleFilter, search]);

  const toggleExpanded = (id) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <DashboardLayout>
      <PageHeader
        title="Users"
        subtitle={`${users.length} registered user${users.length !== 1 ? 's' : ''}`}
        actions={
          /* Role filter select */
          <select
            id="role-filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        }
      />

      {/* ── Search bar ── */}
      <div className="mb-4">
        <input
          id="users-search"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchUsers}>Retry</Button>
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && users.length === 0 && (
        <EmptyState
          icon={<Users size={28} />}
          title="No users found"
          description="No users are registered on the platform yet."
        />
      )}

      {/* ── Users table ── */}
      {!loading && !error && users.length > 0 && (
        <Card padding="sm">
          {/* "Showing all N users" */}
          <p className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
            Showing {filtered.length} of {users.length} users
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border)] text-left">
                  {['', 'Name', 'Email', 'Role', 'Joined', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <Fragment key={u._id}>
                      <tr
                        onClick={() => toggleExpanded(u._id)}
                        className="cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
                      >
                        {/* Avatar */}
                        <td className="px-4 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                            {getInitials(u.name)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                          <div className="flex items-center gap-1.5">
                            {u.name}
                            <ChevronRight
                              size={14}
                              className={`text-[var(--color-text-secondary)] transition-transform duration-200 ${
                                expanded === u._id ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge label={u.role} variant={roleBadgeVariant(u.role)} />
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {formatDate(u.createdAt)}
                        </td>
                        <td
                          className="px-4 py-3 text-xs text-[var(--color-text-secondary)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* No delete / role-change endpoints exist on backend */}
                          <span title="No user management endpoints available">—</span>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expanded === u._id && <UserDetailRow key={`${u._id}-detail`} user={u} />}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Skeleton ── */}
      {loading && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-[var(--color-border)]">
                {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonRow key={n} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

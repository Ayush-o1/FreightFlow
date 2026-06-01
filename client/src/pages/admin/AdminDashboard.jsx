/**
 * AdminDashboard.jsx
 * Platform-wide command center — the admin's home screen.
 *
 * Data strategy:
 *   Uses the dedicated GET /api/admin/analytics endpoint (single call, parallel
 *   DB queries on backend). Falls back to getAllShipments + getAllUsers if needed.
 *   getAnalytics returns: { totalShipments, shipmentsByStatus, totalShippers,
 *     totalDrivers, totalRevenue, recentShipments }
 *   getAllUsers called in parallel to get recent users + totalUsers count.
 *
 * No payment initiation UI. Admin view only.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Building2, Truck, Package, CheckCircle2, Clock,
  ArrowRight,
} from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Spinner         from '../../components/ui/Spinner';
import Button          from '../../components/ui/Button';
import { getAnalytics, getAllUsers } from '../../api/adminApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';
import { getInitials } from '../../utils/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeVariant(role) {
  return role === 'admin' ? 'danger' : role === 'driver' ? 'success' : 'info';
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, colorClass, bgClass, loading }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
        <Icon size={22} className={colorClass} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-7 w-12 animate-pulse rounded bg-[var(--color-border)]" />
        ) : (
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value ?? 0}</p>
        )}
      </div>
    </Card>
  );
}

// ── Status Breakdown Bar ──────────────────────────────────────────────────────
const STATUS_CONFIG = [
  { key: 'pending',    label: 'Pending',    colorClass: 'bg-amber-400',  textClass: 'text-amber-700'  },
  { key: 'assigned',   label: 'Assigned',   colorClass: 'bg-blue-400',   textClass: 'text-blue-700'   },
  { key: 'picked_up',  label: 'Picked Up',  colorClass: 'bg-sky-400',    textClass: 'text-sky-700'    },
  { key: 'in_transit', label: 'In Transit', colorClass: 'bg-indigo-400', textClass: 'text-indigo-700' },
  { key: 'delivered',  label: 'Delivered',  colorClass: 'bg-green-400',  textClass: 'text-green-700'  },
  { key: 'cancelled',  label: 'Cancelled',  colorClass: 'bg-red-400',    textClass: 'text-red-700'    },
];

function StatusBreakdown({ shipmentsByStatus, totalShipments }) {
  return (
    <div className="space-y-2.5">
      {STATUS_CONFIG.map(({ key, label, colorClass, textClass }) => {
        const count = shipmentsByStatus?.[key] ?? 0;
        const pct   = totalShipments > 0 ? Math.round((count / totalShipments) * 100) : 0;
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={`font-medium ${textClass}`}>{label}</span>
              <span className="text-[var(--color-text-secondary)]">{count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Parallel fetch — analytics + users
      const [analyticsRes, usersRes] = await Promise.all([
        getAnalytics(),
        getAllUsers(),
      ]);
      setAnalytics(analyticsRes.data?.data ?? null);
      setUsers(usersRes.data?.data?.users ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived values
  const totalUsers     = users.length;
  const totalShippers  = users.filter((u) => u.role === 'shipper').length;
  const totalDrivers   = users.filter((u) => u.role === 'driver').length;
  const recentUsers    = [...users].slice(0, 5);
  const recentShipments = analytics?.recentShipments ?? [];

  // ── Full-page loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" color="var(--color-primary)" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <DashboardLayout>
        <PageHeader title="Admin Dashboard" />
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide overview — all activity at a glance"
      />

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Users}
          label="Total Users"
          value={totalUsers}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
        <StatCard
          icon={Building2}
          label="Shippers"
          value={totalShippers}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-50"
        />
        <StatCard
          icon={Truck}
          label="Drivers"
          value={totalDrivers}
          colorClass="text-sky-600"
          bgClass="bg-sky-50"
        />
        <StatCard
          icon={Package}
          label="Shipments"
          value={analytics?.totalShipments ?? 0}
          colorClass="text-slate-600"
          bgClass="bg-slate-100"
        />
        <StatCard
          icon={CheckCircle2}
          label="Delivered"
          value={analytics?.shipmentsByStatus?.delivered ?? 0}
          colorClass="text-green-600"
          bgClass="bg-green-50"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={analytics?.shipmentsByStatus?.pending ?? 0}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
      </div>

      {/* ── Main Content — 2-col desktop ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── LEFT: Recent Shipments (3/5 width on desktop) ── */}
        <div className="lg:col-span-3">
          <Card padding="sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Recent Shipments
              </h2>
              <Link
                to="/admin/shipments"
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    {['Tracking #', 'Shipper', 'Status', 'Date'].map((h) => (
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
                  {recentShipments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                        No shipments yet.
                      </td>
                    </tr>
                  ) : (
                    recentShipments.map((s) => (
                      <tr key={s._id} className="hover:bg-[var(--color-bg)] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                          #{s._id?.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-primary)]">
                          {typeof s.shipper === 'object' ? s.shipper?.name : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={formatStatus(s.status)} variant={getStatusVariant(s.status)} />
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {formatDate(s.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ── RIGHT: Recent Users + Status Breakdown (2/5 width on desktop) ── */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Card A — Recent Users */}
          <Card padding="sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Recent Users
              </h2>
              <Link
                to="/admin/users"
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {recentUsers.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                  No users yet.
                </li>
              ) : (
                recentUsers.map((u) => (
                  <li key={u._id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {u.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(u.createdAt)}
                      </p>
                    </div>
                    <Badge label={u.role} variant={roleBadgeVariant(u.role)} />
                  </li>
                ))
              )}
            </ul>
          </Card>

          {/* Card B — Status Breakdown */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
              Shipment Status Breakdown
            </h2>
            <StatusBreakdown
              shipmentsByStatus={analytics?.shipmentsByStatus}
              totalShipments={analytics?.totalShipments ?? 0}
            />
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

/**
 * ShipperDashboard.jsx
 * The shipper's home screen — stats overview + recent shipments table.
 *
 * Data flow:
 *   - Calls GET /api/shipments/my on mount
 *   - Derives 4 stat counts client-side via computeDashboardStats()
 *   - Shows the 5 most-recent shipments in a table
 *
 * Status enum values from Shipment.js:
 *   pending | assigned | picked_up | in_transit | delivered | cancelled
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import Spinner         from '../../components/ui/Spinner';
import EmptyState      from '../../components/ui/EmptyState';

import { useAuth }              from '../../hooks/useAuth';
import { getMyShipments, computeDashboardStats } from '../../api/shipmentApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';

// ── Stat card config ──────────────────────────────────────────────────────────
const STAT_CONFIG = [
  {
    key:       'total',
    label:     'Total Shipments',
    icon:      Package,
    iconBg:    'bg-blue-100',
    iconColor: 'text-blue-600',
    accent:    'border-l-4 border-l-blue-500',
  },
  {
    key:       'pending',
    label:     'Pending',
    icon:      Clock,
    iconBg:    'bg-amber-100',
    iconColor: 'text-amber-600',
    accent:    'border-l-4 border-l-amber-500',
  },
  {
    key:       'inTransit',
    label:     'In Transit',
    icon:      Truck,
    iconBg:    'bg-sky-100',
    iconColor: 'text-sky-600',
    accent:    'border-l-4 border-l-sky-500',
  },
  {
    key:       'delivered',
    label:     'Delivered',
    icon:      CheckCircle2,
    iconBg:    'bg-green-100',
    iconColor: 'text-green-600',
    accent:    'border-l-4 border-l-green-500',
  },
];

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 rounded bg-gray-200 animate-pulse" style={{ width: i === 1 ? '7rem' : i === 6 ? '3.5rem' : '5rem' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ config, value, loading }) {
  const Icon = config.icon;
  return (
    <Card className={`flex items-center gap-4 ${config.accent}`} padding="md">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.iconBg}`}>
        <Icon size={22} className={config.iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {config.label}
        </p>
        {loading ? (
          <div className="mt-1 h-7 w-12 rounded bg-gray-200 animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value ?? 0}</p>
        )}
      </div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShipperDashboard() {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [shipments, setShipments] = useState([]);
  const [stats,     setStats]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await getMyShipments();
      const list = res.data.data.shipments ?? [];
      setShipments(list);
      setStats(computeDashboardStats(list));
    } catch (err) {
      setError(
        err.response?.data?.message ?? 'Failed to load shipments. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // 5 most recent shipments (already sorted newest-first by backend)
  const recentShipments = shipments.slice(0, 5);

  return (
    <DashboardLayout>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.name ?? 'Shipper'} 👋`}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/shipper/shipments/create')}
          >
            <PlusCircle size={16} />
            New Shipment
          </Button>
        }
      />

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CONFIG.map((cfg) => (
          <StatCard
            key={cfg.key}
            config={cfg}
            value={stats[cfg.key]}
            loading={loading}
          />
        ))}
      </div>

      {/* ── Recent Shipments ────────────────────────────────────────────── */}
      <div>
        {/* Section heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Recent Shipments
          </h2>
          <Link
            to="/shipper/shipments"
            className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {/* Error state */}
        {error && !loading && (
          <Card className="border-red-200 bg-red-50" padding="md">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchShipments}>
                <RefreshCw size={14} /> Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Table */}
        {!error && (
          <Card padding="sm">
            {/* Empty state — shown after load with no data */}
            {!loading && recentShipments.length === 0 ? (
              <EmptyState
                icon={<Package size={30} />}
                title="No shipments yet"
                description="Create your first shipment to get started."
                actionLabel="Create Shipment"
                onAction={() => navigate('/shipper/shipments/create')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {['Shipment ID', 'Origin', 'Destination', 'Status', 'Date', 'Action'].map(
                        (col) => (
                          <th
                            key={col}
                            className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                      : recentShipments.map((shipment) => (
                          <tr
                            key={shipment._id}
                            className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50 transition-colors"
                          >
                            {/* Shipment ID — last 8 chars for brevity */}
                            <td className="py-3 px-4 font-mono text-xs text-[var(--color-text-secondary)]">
                              #{shipment._id.slice(-8).toUpperCase()}
                            </td>
                            {/* Origin city */}
                            <td className="py-3 px-4 text-[var(--color-text-primary)]">
                              {shipment.pickupLocation?.city ?? '—'}
                            </td>
                            {/* Destination city */}
                            <td className="py-3 px-4 text-[var(--color-text-primary)]">
                              {shipment.deliveryLocation?.city ?? '—'}
                            </td>
                            {/* Status badge */}
                            <td className="py-3 px-4">
                              <Badge
                                label={formatStatus(shipment.status)}
                                variant={getStatusVariant(shipment.status)}
                              />
                            </td>
                            {/* Created date */}
                            <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                              {formatDate(shipment.createdAt)}
                            </td>
                            {/* View action */}
                            <td className="py-3 px-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate(`/shipper/shipments/${shipment._id}`)
                                }
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

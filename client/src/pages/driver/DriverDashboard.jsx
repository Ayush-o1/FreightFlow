/**
 * DriverDashboard.jsx
 * Driver's home screen — stats overview + active deliveries + recent completed.
 *
 * Data source: GET /api/driver/shipments (via driverApi.getMyAssignments)
 * All stats derived client-side from the returned shipments array.
 * No payment info rendered. No admin features.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, CheckCircle, Clock, MapPin, Navigation, ChevronRight } from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader       from '../../components/shared/PageHeader';
import Card             from '../../components/ui/Card';
import Badge            from '../../components/ui/Badge';
import Button           from '../../components/ui/Button';
import EmptyState       from '../../components/ui/EmptyState';
import { useAuth }      from '../../context/AuthContext';
import { getMyAssignments } from '../../api/driverApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';

// ── Stat card component ────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, colorClass, bgClass, loading }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
        <Icon size={22} className={colorClass} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-6 w-10 animate-pulse rounded bg-[var(--color-border)]" />
        ) : (
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        )}
      </div>
    </Card>
  );
}

// ── Skeleton card for loading ─────────────────────────────────────────────────
function ShipmentCardSkeleton() {
  return (
    <Card className="animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-[var(--color-border)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--color-border)]" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[var(--color-border)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--color-border)]" />
      </div>
      <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
    </Card>
  );
}

// ── Active delivery card ──────────────────────────────────────────────────────
function ActiveDeliveryCard({ shipment, onUpdateClick }) {
  return (
    <Card className="flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[var(--color-text-secondary)] truncate">
          {shipment.trackingNumber ?? shipment._id?.slice(-8).toUpperCase()}
        </span>
        <Badge
          label={formatStatus(shipment.status)}
          variant={getStatusVariant(shipment.status)}
        />
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
        <MapPin size={14} className="shrink-0 text-[var(--color-primary)]" />
        <span className="truncate">{shipment.pickupLocation?.city}</span>
        <Navigation size={12} className="shrink-0 text-[var(--color-text-secondary)]" />
        <span className="truncate">{shipment.deliveryLocation?.city}</span>
      </div>

      {/* Detail row */}
      <p className="text-xs text-[var(--color-text-secondary)]">
        {shipment.goodsType} · {shipment.weight} kg
      </p>

      {/* Action button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onUpdateClick}
        className="mt-1 self-start"
      >
        Update Status <ChevronRight size={14} />
      </Button>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getMyAssignments();
        if (!cancelled) {
          setShipments(res.data?.data?.shipments ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? 'Failed to load assignments.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = {
    total:         shipments.length,
    active:        shipments.filter((s) => s.status === 'picked_up' || s.status === 'in_transit').length,
    delivered:     shipments.filter((s) => s.status === 'delivered').length,
    pendingPickup: shipments.filter((s) => s.status === 'assigned').length,
  };

  // ── Active deliveries (in_transit + picked_up) — max 5 ───────────────────
  const activeDeliveries = shipments
    .filter((s) => s.status === 'picked_up' || s.status === 'in_transit')
    .slice(0, 5);

  // ── Recent completed — last 3 delivered ───────────────────────────────────
  const recentCompleted = shipments
    .filter((s) => s.status === 'delivered')
    .slice(0, 3);

  return (
    <DashboardLayout>
      <PageHeader
        title="Driver Dashboard"
        subtitle={`Welcome, ${user?.name ?? 'Driver'} — here's your workload today`}
      />

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard
          icon={Truck}
          label="Total Assigned"
          value={stats.total}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          loading={loading}
        />
        <StatCard
          icon={Navigation}
          label="Active"
          value={stats.active}
          colorClass="text-sky-600"
          bgClass="bg-sky-50"
          loading={loading}
        />
        <StatCard
          icon={CheckCircle}
          label="Delivered"
          value={stats.delivered}
          colorClass="text-green-600"
          bgClass="bg-green-50"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Pending Pickup"
          value={stats.pendingPickup}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          loading={loading}
        />
      </div>

      {/* ── Active Deliveries ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Active Deliveries
        </h2>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => <ShipmentCardSkeleton key={n} />)}
          </div>
        )}

        {!loading && !error && activeDeliveries.length === 0 && (
          <EmptyState
            icon={<Truck size={28} />}
            title="No active deliveries"
            description="Check back when assignments arrive."
          />
        )}

        {!loading && !error && activeDeliveries.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeDeliveries.map((s) => (
              <ActiveDeliveryCard
                key={s._id}
                shipment={s}
                onUpdateClick={() => navigate('/driver/shipments')}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Completed ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Recent Completed
        </h2>

        {!loading && recentCompleted.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No completed deliveries yet.
          </p>
        )}

        {!loading && recentCompleted.length > 0 && (
          <Card padding="sm">
            <ul className="divide-y divide-[var(--color-border)]">
              {recentCompleted.map((s) => (
                <li
                  key={s._id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 px-1 text-sm"
                >
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {s.trackingNumber ?? s._id?.slice(-8).toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1 text-[var(--color-text-primary)]">
                    {s.pickupLocation?.city}
                    <Navigation size={12} className="text-[var(--color-text-secondary)]" />
                    {s.deliveryLocation?.city}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDate(s.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {loading && (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-[var(--color-border)]" />
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

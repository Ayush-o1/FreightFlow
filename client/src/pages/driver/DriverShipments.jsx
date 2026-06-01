/**
 * DriverShipments.jsx
 * Full list of all shipments assigned to this driver + inline status update.
 *
 * Data source: GET /api/driver/shipments (via driverApi.getMyAssignments)
 * Status update: PATCH /api/driver/shipments/:id/status (via shipmentApi.updateShipmentStatus)
 *   Body: { status: string, note?: string }
 *   Strict forward-only: assigned → picked_up → in_transit → delivered
 *
 * Optimistic update: on success, replace shipment in local state via map() — no refetch.
 * Mobile-first card layout. No payment info rendered.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Package, MapPin, Navigation, Truck,
} from 'lucide-react';

import DashboardLayout  from '../../layouts/DashboardLayout';
import PageHeader        from '../../components/shared/PageHeader';
import Card              from '../../components/ui/Card';
import Badge             from '../../components/ui/Badge';
import Button            from '../../components/ui/Button';
import EmptyState        from '../../components/ui/EmptyState';
import { getMyAssignments }       from '../../api/driverApi';
import { updateShipmentStatus }   from '../../api/shipmentApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';
import { useNotification } from '../../hooks/useNotification';
import { useSocketEvent, joinShipmentRoom, leaveShipmentRoom }  from '../../socket/useSocket';

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS PROGRESSION HELPERS (centralised)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the single valid next status for a driver, or null if none.
 * Mirrors the STATUS_PROGRESSION map in driverController.js exactly.
 */
function getNextStatus(currentStatus) {
  const map = {
    assigned:   'picked_up',
    picked_up:  'in_transit',
    in_transit: 'delivered',
  };
  return map[currentStatus] ?? null;
}

/**
 * Returns the button label for a given current status, or null if no action.
 */
function getActionLabel(currentStatus) {
  const map = {
    assigned:   'Mark Picked Up',
    picked_up:  'Mark In Transit',
    in_transit: 'Mark Delivered',
  };
  return map[currentStatus] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FILTER PILLS
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { label: 'All',        value: 'all' },
  { label: 'Assigned',   value: 'assigned' },
  { label: 'Picked Up',  value: 'picked_up' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
];

function FilterPills({ active, onChange }) {
  return (
    <div
      className="flex flex-wrap gap-2 mb-6"
      role="group"
      aria-label="Filter shipments by status"
    >
      {FILTER_OPTIONS.map(({ label, value }) => (
        <button
          key={value}
          id={`filter-pill-${value}`}
          onClick={() => onChange(value)}
          aria-pressed={active === value}
          className={[
            'rounded-full px-4 py-1.5 text-xs font-medium border transition-all duration-150',
            active === value
              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
              : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="animate-pulse space-y-4">
      <div className="flex justify-between">
        <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--color-border)]" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[var(--color-border)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--color-border)]" />
      </div>
      <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
      <div className="h-8 w-36 rounded-lg bg-[var(--color-border)]" />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHIPMENT CARD WITH INLINE STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

// ShipmentCard receives showToast from parent via prop to keep card stateless
function ShipmentCard({ shipment, onStatusUpdated, showToast }) {
  const nextStatus  = getNextStatus(shipment.status);
  const actionLabel = getActionLabel(shipment.status);

  // Per-card state for the inline update flow
  const [expanded,   setExpanded]   = useState(false);  // shows note field + confirm/cancel
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cardError,  setCardError]  = useState(null);

  const handleConfirm = async () => {
    if (!nextStatus) return;
    try {
      setSubmitting(true);
      setCardError(null);
      const payload = { status: nextStatus };
      if (note.trim()) payload.note = note.trim();
      const res = await updateShipmentStatus(shipment._id, payload);
      const updated = res.data?.data?.shipment;
      // Collapse the inline form
      setExpanded(false);
      setNote('');
      // Show success toast
      showToast('success', `Status updated to ${formatStatus(nextStatus)}`);
      // Bubble updated shipment to parent for optimistic state replacement
      if (updated) onStatusUpdated(updated);
    } catch (err) {
      setCardError(err?.response?.data?.message ?? 'Failed to update status. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setExpanded(false);
    setNote('');
    setCardError(null);
  };

  const isTerminal = shipment.status === 'delivered' || shipment.status === 'cancelled';

  return (
    <Card className="flex flex-col gap-3">
      {/* ── TOP ROW ── */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-medium text-[var(--color-text-secondary)]">
          {shipment.trackingNumber ?? `#${shipment._id?.slice(-8).toUpperCase()}`}
        </span>
        <Badge
          label={formatStatus(shipment.status)}
          variant={getStatusVariant(shipment.status)}
        />
      </div>

      {/* ── ROUTE BLOCK ── */}
      <div className="rounded-lg bg-[var(--color-bg)] p-3 space-y-1.5">
        <div className="flex items-start gap-2 text-sm">
          <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
          <div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] block">
              Pickup
            </span>
            <span className="text-[var(--color-text-primary)]">
              {shipment.pickupLocation?.address}, {shipment.pickupLocation?.city}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Navigation size={14} className="mt-0.5 shrink-0 text-green-600" />
          <div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] block">
              Delivery
            </span>
            <span className="text-[var(--color-text-primary)]">
              {shipment.deliveryLocation?.address}, {shipment.deliveryLocation?.city}
            </span>
          </div>
        </div>
      </div>

      {/* ── DETAIL ROW ── */}
      <p className="text-xs text-[var(--color-text-secondary)]">
        <span className="mr-3">📦 {shipment.goodsType}</span>
        <span className="mr-3">⚖️ {shipment.weight} kg</span>
        <span>📅 {formatDate(shipment.createdAt)}</span>
      </p>

      {/* ── STATUS UPDATE ROW ── */}
      {isTerminal ? (
        <p className="text-xs font-medium text-[var(--color-text-secondary)] italic">
          {shipment.status === 'delivered' ? '✅ Completed' : '❌ Cancelled'}
        </p>
      ) : (
        <div className="border-t border-[var(--color-border)] pt-3">
          {!expanded ? (
            /* Initial action button */
            <Button
              id={`action-btn-${shipment._id}`}
              variant="primary"
              size="sm"
              onClick={() => { setExpanded(true); setCardError(null); }}
              disabled={!nextStatus}
            >
              {actionLabel}
            </Button>
          ) : (
            /* Expanded inline update form */
            <div className="space-y-3">
              {/* Optional note textarea */}
              <div>
                <label
                  htmlFor={`note-${shipment._id}`}
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  Note (optional)
                </label>
                <textarea
                  id={`note-${shipment._id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder={`e.g. Picked up from warehouse at ${new Date().toLocaleTimeString()}`}
                  rows={2}
                  className={[
                    'w-full rounded-lg border px-3 py-2 text-sm resize-none',
                    'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
                    'border-[var(--color-border)] focus:outline-none',
                    'focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
                    'placeholder:text-[var(--color-text-secondary)]',
                  ].join(' ')}
                />
              </div>

              {/* Confirm / Cancel buttons */}
              <div className="flex items-center gap-2">
                <Button
                  id={`confirm-btn-${shipment._id}`}
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  onClick={handleConfirm}
                >
                  Confirm: {actionLabel}
                </Button>
                <Button
                  id={`cancel-btn-${shipment._id}`}
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>

              {/* Inline error */}
              {cardError && (
                <p className="text-xs text-red-600 font-medium">{cardError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverShipments() {
  const [shipments,    setShipments]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const { showToast } = useNotification();

  // ── Fetch on mount ────────────────────────────────────────────────────────
  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyAssignments();
      setShipments(res.data?.data?.shipments ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    if (!shipments.length) return undefined;

    shipments.forEach((shipment) => joinShipmentRoom(shipment._id));

    return () => {
      shipments.forEach((shipment) => leaveShipmentRoom(shipment._id));
    };
  }, [shipments]);

  // ── Optimistic status update ──────────────────────────────────────────────
  // Replace updated shipment in state without refetching the full list.
  const handleStatusUpdated = useCallback((updatedShipment) => {
    setShipments((prev) =>
      prev.map((s) => (s._id === updatedShipment._id ? updatedShipment : s))
    );
  }, []);

  // ── Live: 'statusUpdated' from backend (sync across sessions/tabs) ────────
  // Payload: { shipmentId, newStatus, updatedBy, role, note, timestamp }
  useSocketEvent('statusUpdated', useCallback((data) => {
    setShipments((prev) =>
      prev.map((s) =>
        s._id === data.shipmentId ? { ...s, status: data.newStatus } : s
      )
    );
  }, []));

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = activeFilter === 'all'
    ? shipments
    : shipments.filter((s) => s.status === activeFilter);

  return (
    <DashboardLayout>
      <PageHeader
        title="My Assignments"
        subtitle={`${shipments.length} total assignment${shipments.length !== 1 ? 's' : ''}`}
      />

      {/* ── Filter pills ── */}
      <FilterPills active={activeFilter} onChange={setActiveFilter} />

      {/* ── Error state ── */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchShipments}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && shipments.length === 0 && (
        <EmptyState
          icon={<Package size={28} />}
          title="No assignments yet"
          description="Your shipments will appear here once assigned by an admin."
        />
      )}

      {/* ── Filtered empty (has shipments but filter returns nothing) ── */}
      {!loading && !error && shipments.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<Truck size={28} />}
          title="No shipments match this filter"
          description={`You have no shipments with status "${activeFilter}".`}
          actionLabel="Show All"
          onAction={() => setActiveFilter('all')}
        />
      )}

      {/* ── Shipment cards ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <ShipmentCard
              key={s._id}
              shipment={s}
              onStatusUpdated={handleStatusUpdated}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

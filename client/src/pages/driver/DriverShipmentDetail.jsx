/**
 * DriverShipmentDetail.jsx
 * Full detail view of a single shipment assigned to the driver.
 *
 * Data source: GET /api/driver/shipments/:id (via driverApi.getAssignmentById)
 * Status update: PATCH /api/driver/shipments/:id/status (via shipmentApi.updateShipmentStatus)
 *
 * Socket: joins `shipment_${id}` room on mount — receives 'statusUpdated' events
 * in real time and refreshes local state without a full refetch.
 *
 * Status progression (driver-only, forward):
 *   assigned → picked_up → in_transit → delivered
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate }           from 'react-router-dom';
import {
  ArrowLeft, MapPin, Navigation, Package, Weight,
  Calendar, Clock, CheckCircle2, User, FileText, Truck,
} from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import Spinner         from '../../components/ui/Spinner';

import { getAssignmentById }  from '../../api/driverApi';
import { updateShipmentStatus } from '../../api/shipmentApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';
import { useNotification } from '../../hooks/useNotification';
import { useSocketEvent, joinShipmentRoom, leaveShipmentRoom } from '../../socket/useSocket';

// ─── Status progression map (mirrors driverController.js exactly) ─────────────
const STATUS_PROGRESSION = {
  assigned:   'picked_up',
  picked_up:  'in_transit',
  in_transit: 'delivered',
};

const ACTION_LABELS = {
  assigned:   'Mark Picked Up',
  picked_up:  'Mark In Transit',
  in_transit: 'Mark Delivered',
};

// ─── Status History Timeline ──────────────────────────────────────────────────
function StatusTimeline({ history }) {
  if (!history?.length) return null;
  return (
    <div className="space-y-3">
      {[...history].reverse().map((entry, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
            <div className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                label={formatStatus(entry.status)}
                variant={getStatusVariant(entry.status)}
              />
              {entry.updatedBy?.name && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  by {entry.updatedBy.name}
                </span>
              )}
            </div>
            {entry.note && (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{entry.note}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {formatDate(entry.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
        <Icon size={15} className="text-[var(--color-primary)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-[var(--color-text-primary)] font-medium break-words">
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

// ─── Location Card ────────────────────────────────────────────────────────────
function LocationCard({ type, location }) {
  const isPickup = type === 'pickup';
  const Icon     = isPickup ? MapPin : Navigation;
  const color    = isPickup ? 'text-[var(--color-primary)]' : 'text-green-600';
  const bg       = isPickup ? 'bg-[var(--color-primary-light)]' : 'bg-green-50';
  const label    = isPickup ? 'Pickup Location' : 'Delivery Location';

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
          <Icon size={14} className={color} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {location?.address}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {location?.city}, {location?.state} — {location?.pincode}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DriverShipmentDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { showToast } = useNotification();

  const [shipment,   setShipment]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Status-update form state
  const [showForm,   setShowForm]   = useState(false);
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState(null);

  // ── Fetch shipment ──────────────────────────────────────────────────────────
  const fetchShipment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAssignmentById(id);
      setShipment(res.data?.data?.shipment ?? null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) {
        setError('Access denied. This shipment is not assigned to you.');
      } else if (status === 404) {
        setError('Shipment not found.');
      } else {
        setError(err?.response?.data?.message ?? 'Failed to load shipment details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchShipment(); }, [fetchShipment]);

  // ── Socket room management ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    joinShipmentRoom(id);
    return () => leaveShipmentRoom(id);
  }, [id]);

  // ── Live status updates via socket ─────────────────────────────────────────
  useSocketEvent('statusUpdated', useCallback((data) => {
    if (data.shipmentId !== id) return;
    setShipment((prev) => prev ? { ...prev, status: data.newStatus } : prev);
    showToast('info', `Status updated to ${formatStatus(data.newStatus)}`);
  }, [id, showToast]));

  // ── Status update handler ───────────────────────────────────────────────────
  const nextStatus   = shipment ? STATUS_PROGRESSION[shipment.status] : null;
  const actionLabel  = shipment ? ACTION_LABELS[shipment.status] : null;
  const isTerminal   = shipment
    ? !Object.keys(STATUS_PROGRESSION).includes(shipment.status)
    : true;

  const handleStatusUpdate = async () => {
    if (!nextStatus) return;
    try {
      setSubmitting(true);
      setFormError(null);
      const payload = { status: nextStatus };
      if (note.trim()) payload.note = note.trim();
      const res = await updateShipmentStatus(id, payload);
      const updated = res.data?.data?.shipment;
      if (updated) setShipment(updated);
      setShowForm(false);
      setNote('');
      showToast('success', `Status updated to ${formatStatus(nextStatus)}`);
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to update status. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" color="var(--color-primary)" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !shipment) {
    return (
      <DashboardLayout>
        <PageHeader title="Shipment Details" />
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error ?? 'Shipment not found.'}</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/driver/shipments')}>
              Back to List
            </Button>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Shipment Details"
        subtitle={shipment.trackingNumber ?? `#${shipment._id?.slice(-8).toUpperCase()}`}
        actions={
          <Button
            id="back-to-list-btn"
            variant="secondary"
            size="sm"
            onClick={() => navigate('/driver/shipments')}
          >
            <ArrowLeft size={14} />
            Back to List
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── LEFT COLUMN: Core details ──────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Status Banner */}
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)]">
                <Truck size={20} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Current Status
                </p>
                <Badge
                  label={formatStatus(shipment.status)}
                  variant={getStatusVariant(shipment.status)}
                />
              </div>
            </div>

            {/* Status update action — hidden if terminal */}
            {!isTerminal && (
              <div className="shrink-0">
                {!showForm ? (
                  <Button
                    id="status-action-btn"
                    variant="primary"
                    size="sm"
                    onClick={() => { setShowForm(true); setFormError(null); }}
                  >
                    {actionLabel}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowForm(false); setNote(''); setFormError(null); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Inline status update form */}
          {showForm && !isTerminal && (
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                Confirm: {actionLabel}
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="status-note"
                    className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
                  >
                    Note <span className="text-[var(--color-text-muted)]">(optional)</span>
                  </label>
                  <textarea
                    id="status-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="e.g. Collected from warehouse at gate 3"
                    className={[
                      'w-full rounded-lg border px-3 py-2 text-sm resize-none',
                      'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
                      'border-[var(--color-border)] focus:outline-none',
                      'focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
                      'placeholder:text-[var(--color-text-muted)]',
                    ].join(' ')}
                  />
                </div>
                {formError && (
                  <p className="text-xs font-medium text-red-600">{formError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    id="confirm-status-btn"
                    variant="primary"
                    size="sm"
                    loading={submitting}
                    onClick={handleStatusUpdate}
                  >
                    Confirm: {actionLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={submitting}
                    onClick={() => { setShowForm(false); setNote(''); setFormError(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Locations */}
          <div className="grid gap-4 sm:grid-cols-2">
            <LocationCard type="pickup"   location={shipment.pickupLocation} />
            <LocationCard type="delivery" location={shipment.deliveryLocation} />
          </div>

          {/* Goods Info */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
              Cargo Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Package}  label="Goods Type"  value={shipment.goodsType} />
              <InfoRow icon={Weight}   label="Weight"      value={`${shipment.weight} kg`} />
              {shipment.description && (
                <InfoRow
                  icon={FileText}
                  label="Description"
                  value={shipment.description}
                />
              )}
              {shipment.estimatedDelivery && (
                <InfoRow
                  icon={Calendar}
                  label="Est. Delivery"
                  value={formatDate(shipment.estimatedDelivery)}
                />
              )}
            </div>
          </Card>

          {/* Shipper Info */}
          {shipment.shipper && (
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                Shipper
              </h3>
              <InfoRow
                icon={User}
                label="Name"
                value={`${shipment.shipper.name} (${shipment.shipper.email})`}
              />
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN: Status history + meta ────────────────────────── */}
        <div className="space-y-6">

          {/* Shipment Meta */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
              Shipment Info
            </h3>
            <div className="space-y-3">
              <InfoRow
                icon={FileText}
                label="Tracking No."
                value={shipment.trackingNumber ?? '—'}
              />
              <InfoRow
                icon={Clock}
                label="Created"
                value={formatDate(shipment.createdAt)}
              />
              <InfoRow
                icon={CheckCircle2}
                label="Last Updated"
                value={formatDate(shipment.updatedAt)}
              />
            </div>
          </Card>

          {/* Status History Timeline */}
          {shipment.statusHistory?.length > 0 && (
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                Status History
              </h3>
              <StatusTimeline history={shipment.statusHistory} />
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

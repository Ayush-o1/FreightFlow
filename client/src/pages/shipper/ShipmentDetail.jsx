/**
 * ShipmentDetail.jsx
 * Full detail view for a single shipment.
 *
 * Sections:
 *   1. Top bar — back link, title, status badge
 *   2. Status timeline — 6-step vertical stepper driven by statusHistory
 *   3. Route card (left) + Cargo card (right) — 2-col grid
 *   4. Driver info card — only if driver is a populated object (not ObjectId string)
 *   5. Payment card — full 2-step payment flow (initiate → confirm)
 *   6. Cancel zone — OMITTED (no backend cancel endpoint exists)
 *
 * Payment flow:
 *   paymentStatus === 'unpaid' → form: amount + paymentMethod → initiatePayment()
 *   → creates pending Payment record → then confirmPayment(paymentId, 'success')
 *   → marks paid, refreshes both shipment + payment data
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Package,
  User,
  CreditCard,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import Select          from '../../components/ui/Select';
import Input           from '../../components/ui/Input';

import { getShipmentById }                         from '../../api/shipmentApi';
import { getPaymentByShipment, initiatePayment, confirmPayment } from '../../api/paymentApi';
import { formatDate, formatCurrency, formatStatus, getStatusVariant } from '../../utils/formatters';
import { useSocketEvent, joinShipmentRoom, leaveShipmentRoom } from '../../socket/useSocket';
import { useNotification } from '../../hooks/useNotification';

// ── Status timeline config ────────────────────────────────────────────────────
// Order of steps. 'cancelled' is handled separately as a terminal error state.
const TIMELINE_STEPS = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'];

const STEP_ICONS = {
  pending:    Clock,
  assigned:   User,
  picked_up:  Package,
  in_transit: MapPin,
  delivered:  CheckCircle2,
  cancelled:  XCircle,
};

// ── Payment method options (from Payment.js enum) ─────────────────────────────
const PAYMENT_METHOD_OPTIONS = [
  { label: 'Credit / Debit Card', value: 'card' },
  { label: 'UPI',                 value: 'upi' },
  { label: 'Net Banking',         value: 'netbanking' },
];

const PAYMENT_VARIANT = { unpaid: 'danger', paid: 'success', failed: 'warning', pending: 'warning' };
const PAYMENT_LABEL   = { unpaid: 'Unpaid', paid: 'Paid', failed: 'Failed', pending: 'Pending' };

// ── Skeleton block ────────────────────────────────────────────────────────────
function SkeletonBlock({ className = '' }) {
  return <div className={`rounded bg-gray-200 animate-pulse ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SkeletonBlock className="h-52" />
        <SkeletonBlock className="h-52" />
      </div>
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-44" />
    </div>
  );
}

// ── Detail row helper ─────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--color-text-primary)]">{value ?? '—'}</span>
    </div>
  );
}

// ── Status Timeline component ─────────────────────────────────────────────────
function StatusTimeline({ currentStatus, statusHistory = [] }) {
  const isCancelled = currentStatus === 'cancelled';

  // Build a map: status → timestamp from statusHistory
  const historyMap = {};
  statusHistory.forEach((entry) => {
    if (entry?.status) historyMap[entry.status] = entry.timestamp;
  });

  const stepsToRender = isCancelled
    ? [...TIMELINE_STEPS, 'cancelled']
    : TIMELINE_STEPS;

  const currentIdx = isCancelled
    ? stepsToRender.length - 1
    : TIMELINE_STEPS.indexOf(currentStatus);

  return (
    <ol className="relative ml-4 space-y-0">
      {stepsToRender.map((step, idx) => {
        const Icon       = STEP_ICONS[step] ?? Circle;
        const isCompleted = idx < currentIdx;
        const isCurrent   = idx === currentIdx;
        const isUpcoming  = idx > currentIdx;
        const isError     = step === 'cancelled';

        const circleClass = isError
          ? 'bg-red-100 text-[var(--color-danger)] ring-2 ring-red-300'
          : isCompleted
          ? 'bg-green-100 text-green-600 ring-2 ring-green-300'
          : isCurrent
          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
          : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200';

        const labelClass = isError
          ? 'font-semibold text-[var(--color-danger)]'
          : isCompleted
          ? 'font-medium text-green-700'
          : isCurrent
          ? 'font-semibold text-[var(--color-primary)]'
          : 'text-[var(--color-text-muted)]';

        const lineClass = isCompleted || (isCurrent && !isUpcoming)
          ? 'bg-green-300'
          : 'bg-gray-200';

        return (
          <li key={step} className="flex gap-4">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
                  circleClass,
                  isCurrent && !isError ? 'animate-pulse' : '',
                ].join(' ')}
              >
                <Icon size={16} />
              </div>
              {idx < stepsToRender.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-[1.5rem] ${lineClass}`} />
              )}
            </div>

            {/* Label + timestamp */}
            <div className="pb-4 pt-1.5 min-w-0">
              <p className={`text-sm ${labelClass}`}>
                {formatStatus(step)}
                {isCurrent && !isError && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                    (current)
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {historyMap[step] ? formatDate(historyMap[step]) : '—'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Payment section ───────────────────────────────────────────────────────────
function PaymentSection({ shipment, payment, onRefresh }) {
  const shipmentId      = shipment._id;
  const paymentStatus   = shipment.paymentStatus;

  const [showForm,      setShowForm]      = useState(false);
  const [amount,        setAmount]        = useState('');
  const [method,        setMethod]        = useState('card');
  const [formError,     setFormError]     = useState('');
  const [initiating,    setInitiating]    = useState(false);
  const [confirming,    setConfirming]    = useState(false);
  const [successMsg,    setSuccessMsg]    = useState('');

  // ── Step 1: Initiate ────────────────────────────────────────────────────
  const handleInitiate = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }

    setInitiating(true);
    try {
      await initiatePayment(shipmentId, {
        amount:        Number(amount),
        paymentMethod: method,
      });
      // Auto-confirm as success immediately after initiation
      await handleAutoConfirm();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to initiate payment.');
      setInitiating(false);
    }
  };

  // ── Step 2: Confirm (auto-called right after initiate) ──────────────────
  const handleAutoConfirm = async () => {
    setConfirming(true);
    try {
      // Fetch the newly created payment to get its _id
      const payRes = await getPaymentByShipment(shipmentId);
      const pid    = payRes.data.data.payment._id;
      await confirmPayment(pid, 'success');
      setSuccessMsg('Payment successful! This shipment is now marked as paid.');
      setShowForm(false);
      setTimeout(() => {
        setSuccessMsg('');
        onRefresh();
      }, 2000);
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Payment confirmation failed.');
    } finally {
      setInitiating(false);
      setConfirming(false);
    }
  };

  const isProcessing = initiating || confirming;

  return (
    <Card padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
            <CreditCard size={18} className="text-purple-600" />
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Payment</h2>
        </div>
        <Badge
          label={PAYMENT_LABEL[paymentStatus] ?? paymentStatus ?? '—'}
          variant={PAYMENT_VARIANT[paymentStatus] ?? 'default'}
        />
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✅ {successMsg}
        </div>
      )}

      {/* ── PAID state ────────────────────────────────────────────────── */}
      {paymentStatus === 'paid' && payment && (
        <div className="space-y-1">
          <DetailRow label="Amount"         value={formatCurrency(payment.amount)} />
          <DetailRow label="Method"         value={payment.paymentMethod?.toUpperCase()} />
          <DetailRow label="Transaction ID" value={payment.transactionId ?? '—'} />
          <DetailRow label="Paid On"        value={formatDate(payment.paidAt)} />
        </div>
      )}

      {/* ── UNPAID state — show make-payment form ─────────────────────── */}
      {paymentStatus === 'unpaid' && !successMsg && (
        <div>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            No payment has been made for this shipment yet.
          </p>

          {!showForm ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => setShowForm(true)}
            >
              Make Payment
            </Button>
          ) : (
            <form onSubmit={handleInitiate} className="space-y-4" noValidate>
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
                >
                  {formError}
                </div>
              )}

              <Input
                label="Amount (USD)"
                name="amount"
                type="number"
                placeholder="e.g. 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isProcessing}
              />

              <Select
                label="Payment Method"
                name="paymentMethod"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                options={PAYMENT_METHOD_OPTIONS}
                disabled={isProcessing}
              />

              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isProcessing}
                  disabled={isProcessing}
                  fullWidth
                >
                  {confirming ? 'Confirming…' : initiating ? 'Initiating…' : 'Confirm Payment'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-center text-xs text-[var(--color-text-muted)]">
                This is a simulated payment — no real charge is made.
              </p>
            </form>
          )}
        </div>
      )}

      {/* ── FAILED state ──────────────────────────────────────────────── */}
      {paymentStatus === 'failed' && (
        <p className="text-sm text-[var(--color-danger)]">
          The previous payment attempt failed. Please contact support or retry.
        </p>
      )}

      {/* ── PENDING state (payment initiated but not confirmed) ────────── */}
      {paymentStatus === 'pending' && payment && (
        <div className="space-y-1">
          <p className="mb-3 text-sm text-amber-600 font-medium">
            Payment has been initiated and is being processed.
          </p>
          <DetailRow label="Amount" value={formatCurrency(payment.amount)} />
          <DetailRow label="Method" value={payment.paymentMethod?.toUpperCase()} />
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShipmentDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { addNotification, showToast } = useNotification();

  const [shipment,     setShipment]     = useState(null);
  const [payment,      setPayment]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [shipRes] = await Promise.all([
        getShipmentById(id),
      ]);
      setShipment(shipRes.data.data.shipment);

      // Fetch payment separately — 404 means no payment yet (not an error)
      try {
        const payRes = await getPaymentByShipment(id);
        setPayment(payRes.data.data.payment);
      } catch (payErr) {
        if (payErr.response?.status !== 404) {
          console.warn('Payment fetch error:', payErr.message);
        }
        setPayment(null);
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Join/leave the per-shipment socket room for live updates ──────────────
  // Room name on backend: `shipment_${id}` (confirmed from socketService.js)
  useEffect(() => {
    if (!id) return;
    joinShipmentRoom(id);
    return () => leaveShipmentRoom(id);
  }, [id]);

  // ── Live: 'statusUpdated' — driver advanced the status ───────────────────
  // Payload: { shipmentId, newStatus, updatedBy, role, note, timestamp }
  useSocketEvent('statusUpdated', useCallback((data) => {
    if (data.shipmentId !== id) return;
    setShipment((prev) => prev ? { ...prev, status: data.newStatus } : prev);
    addNotification('info', 'Status Updated', `Status changed to ${formatStatus(data.newStatus)}`);
    showToast('info', `Shipment status: ${formatStatus(data.newStatus)}`);
  }, [id, addNotification, showToast]));

  // ── Live: 'driverAssigned' — admin assigned a driver ─────────────────────
  // Payload: { shipmentId, driverId, driverName, status, message, timestamp }
  useSocketEvent('driverAssigned', useCallback((data) => {
    if (data.shipmentId !== id) return;
    setShipment((prev) => prev ? { ...prev, status: data.status } : prev);
    addNotification('info', 'Driver Assigned', `${data.driverName} has been assigned to your shipment`);
    showToast('info', `Driver assigned: ${data.driverName}`);
  }, [id, addNotification, showToast]));

  // ── Live: 'shipmentDelivered' — extra event when status === 'delivered' ───
  // Payload: { shipmentId, message, timestamp }
  useSocketEvent('shipmentDelivered', useCallback((data) => {
    if (data.shipmentId !== id) return;
    addNotification('success', 'Shipment Delivered!', data.message ?? 'Your shipment has been delivered.');
    showToast('success', data.message ?? 'Your shipment has been delivered!');
  }, [id, addNotification, showToast]));

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="mb-5">
          <Link to="/shipper/shipments" className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors w-fit">
            <ArrowLeft size={16} /> Back to Shipments
          </Link>
        </div>
        <DetailSkeleton />
      </DashboardLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !shipment) {
    return (
      <DashboardLayout>
        <Link to="/shipper/shipments" className="mb-5 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] w-fit">
          <ArrowLeft size={16} /> Back to Shipments
        </Link>
        <Card className="border-red-200 bg-red-50" padding="lg">
          <p className="mb-4 text-sm text-[var(--color-danger)]">
            {error || 'Shipment not found.'}
          </p>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw size={14} /> Retry
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const { pickupLocation, deliveryLocation, goodsType, weight, description,
          estimatedDelivery, status, paymentStatus, driver, statusHistory } = shipment;

  // Driver populated check — only render driver card if driver is an object with a name
  const driverIsPopulated = driver && typeof driver === 'object' && driver.name;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">

        {/* ── 1. Top bar ──────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/shipper/shipments"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors w-fit"
          >
            <ArrowLeft size={16} />
            Back to Shipments
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] font-mono">
              #{shipment._id.slice(-10).toUpperCase()}
            </h1>
            <Badge
              label={formatStatus(status)}
              variant={getStatusVariant(status)}
            />
          </div>
        </div>

        {/* ── 2. Status Timeline ──────────────────────────────────────── */}
        <Card padding="lg" className="mb-5">
          <h2 className="mb-5 text-base font-semibold text-[var(--color-text-primary)]">
            Shipment Progress
          </h2>
          <StatusTimeline currentStatus={status} statusHistory={statusHistory} />
        </Card>

        {/* ── 3. Route + Cargo — 2-col grid ───────────────────────────── */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Route card */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Route Details</h2>
            </div>

            <div className="mb-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                📍 Pickup
              </p>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-[var(--color-text-primary)] leading-relaxed">
                {pickupLocation?.address}<br />
                {pickupLocation?.city}, {pickupLocation?.state} – {pickupLocation?.pincode}
              </div>
            </div>

            <div className="my-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-text-muted)]">▼</span>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                🏁 Delivery
              </p>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-[var(--color-text-primary)] leading-relaxed">
                {deliveryLocation?.address}<br />
                {deliveryLocation?.city}, {deliveryLocation?.state} – {deliveryLocation?.pincode}
              </div>
            </div>
          </Card>

          {/* Cargo card */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                <Package size={18} className="text-orange-600" />
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Cargo Information</h2>
            </div>
            <DetailRow label="Goods Type"          value={goodsType} />
            <DetailRow label="Weight"              value={weight != null ? `${weight} kg` : '—'} />
            <DetailRow label="Description"         value={description || '—'} />
            <DetailRow
              label="Estimated Delivery"
              value={estimatedDelivery ? formatDate(estimatedDelivery) : '—'}
            />
            <DetailRow label="Created"             value={formatDate(shipment.createdAt)} />
          </Card>
        </div>

        {/* ── 4. Driver card ──────────────────────────────────────────── */}
        <Card padding="lg" className="mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100">
              <User size={18} className="text-sky-600" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Assigned Driver</h2>
          </div>
          {driverIsPopulated ? (
            <>
              <DetailRow label="Name"  value={driver.name} />
              <DetailRow label="Email" value={driver.email ?? '—'} />
              {/* Note: Shipment.driver only populates name + email (per controller populate call) */}
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] italic">
              No driver has been assigned to this shipment yet.
            </p>
          )}
        </Card>

        {/* ── 5. Payment card ─────────────────────────────────────────── */}
        <PaymentSection
          shipment={shipment}
          payment={payment}
          onRefresh={fetchData}
        />

        {/* ── 6. Cancel zone — OMITTED: no backend cancel endpoint ──────
             The backend only exposes: POST /, GET /my, GET /:id.
             There is no cancel/PATCH route. Section intentionally hidden.
        ─────────────────────────────────────────────────────────────── */}

      </div>
    </DashboardLayout>
  );
}

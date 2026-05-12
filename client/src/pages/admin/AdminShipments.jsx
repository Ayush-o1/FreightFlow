/**
 * AdminShipments.jsx
 * Platform-wide shipment management for admin.
 *
 * Endpoint: GET /api/admin/shipments (?status ?search ?page ?limit)
 * Backend pagination: page/limit supported (default page=1, limit=10).
 * Populate: shipper and driver returned as { name, email } objects.
 *   If driver is null → show "Unassigned" in amber.
 *
 * "Assign Driver" shown only when status === 'pending' (backend enforces this).
 * No payment initiation UI.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight, ArrowRight } from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import EmptyState      from '../../components/ui/EmptyState';
import { getAllShipments } from '../../api/adminApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';
import { useSocketEvent }    from '../../socket/useSocket';
import { useNotification }  from '../../hooks/useNotification';

// ── Filter config ─────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Pending',    value: 'pending' },
  { label: 'Assigned',   value: 'assigned' },
  { label: 'Picked Up',  value: 'picked_up' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
  { label: 'Cancelled',  value: 'cancelled' },
];

// ── Payment badge ─────────────────────────────────────────────────────────────
function paymentVariant(ps) {
  return ps === 'paid' ? 'success' : ps === 'failed' ? 'danger' : 'warning';
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 animate-pulse rounded bg-[var(--color-border)]" />
        </td>
      ))}
    </tr>
  );
}

// ── Driver cell ───────────────────────────────────────────────────────────────
function DriverCell({ driver }) {
  if (!driver) {
    return <span className="text-xs font-medium text-amber-600">Unassigned</span>;
  }
  if (typeof driver === 'object') return <span>{driver.name}</span>;
  // Raw ID fallback (shouldn't happen — backend populates)
  return <span className="font-mono text-xs">{driver}</span>;
}

// ── Shipper cell ──────────────────────────────────────────────────────────────
function ShipperCell({ shipper }) {
  if (!shipper) return <span className="text-[var(--color-text-secondary)]">—</span>;
  if (typeof shipper === 'object') return <span>{shipper.name}</span>;
  return <span className="font-mono text-xs">{shipper}</span>;
}

// ── Pagination controls ───────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={onPrev}>
          ← Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminShipments() {
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [shipments,   setShipments]   = useState([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Server-side filters
  const [statusFilter, setStatusFilter] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [searchInput,  setSearchInput]  = useState('');

  const PAGE_LIMIT = 10;

  const fetchShipments = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: p, limit: PAGE_LIMIT };
      if (statusFilter) params.status = statusFilter;
      if (serverSearch)  params.search = serverSearch;
      const res = await getAllShipments(params);
      const d   = res.data?.data ?? {};
      setShipments(d.shipments ?? []);
      setTotal(d.total ?? 0);
      setTotalPages(d.totalPages ?? 1);
      setPage(d.page ?? p);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load shipments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serverSearch]);

  useEffect(() => {
    fetchShipments(1);
  }, [fetchShipments]);

  // ── Live: 'statusUpdated' — driver advanced a shipment status ─────────────
  // Payload: { shipmentId, newStatus, updatedBy, role, note, timestamp }
  // Admin is not in any shipment room — but this fires if the socket global
  // receives the broadcast. The server emits to room: `shipment_${shipmentId}`.
  // Admin page updates state if the shipment is currently visible in the list.
  useSocketEvent('statusUpdated', useCallback((data) => {
    setShipments((prev) =>
      prev.map((s) =>
        s._id === data.shipmentId ? { ...s, status: data.newStatus } : s
      )
    );
    addNotification(
      'info',
      'Shipment Status Changed',
      `Shipment #${data.shipmentId?.slice(-6).toUpperCase()} → ${formatStatus(data.newStatus)}`
    );
  }, [addNotification]));

  // ── Live: 'driverAssigned' — admin assigned a driver ─────────────────────
  // Payload: { shipmentId, driverId, driverName, status, message, timestamp }
  useSocketEvent('driverAssigned', useCallback((data) => {
    setShipments((prev) =>
      prev.map((s) =>
        s._id === data.shipmentId
          ? { ...s, status: data.status ?? 'assigned' }
          : s
      )
    );
    addNotification(
      'info',
      'Driver Assigned',
      `${data.driverName} assigned to shipment #${data.shipmentId?.slice(-6).toUpperCase()}`
    );
  }, [addNotification]));
  // Debounce search — apply on Enter or after 500ms
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') setServerSearch(searchInput.trim());
  };

  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="All Shipments"
        subtitle={`${total} total shipment${total !== 1 ? 's' : ''}`}
      />

      {/* ── Status filter pills ── */}
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by status"
      >
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            id={`shipment-filter-${value || 'all'}`}
            onClick={() => handleStatusFilter(value)}
            aria-pressed={statusFilter === value}
            className={[
              'rounded-full px-4 py-1.5 text-xs font-medium border transition-all duration-150',
              statusFilter === value
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="mb-6 flex gap-2">
        <input
          id="shipments-search"
          type="text"
          placeholder="Search by shipper, driver, or goods type… (press Enter)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setServerSearch(searchInput.trim())}
        >
          Search
        </Button>
        {serverSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setServerSearch(''); setSearchInput(''); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchShipments(page)}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && shipments.length === 0 && (
        <EmptyState
          icon={<Package size={28} />}
          title="No shipments found"
          description={statusFilter ? `No shipments with status "${statusFilter}".` : 'No shipments on the platform yet.'}
          actionLabel={statusFilter ? 'Show All' : undefined}
          onAction={statusFilter ? () => handleStatusFilter('') : undefined}
        />
      )}

      {/* ── Table ── */}
      {!loading && !error && shipments.length > 0 && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  {['Tracking #', 'Shipper', 'Driver', 'Route', 'Goods / Weight', 'Status', 'Payment', 'Date', 'Actions'].map((h) => (
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
                {shipments.map((s) => (
                  <tr key={s._id} className="hover:bg-[var(--color-bg)] transition-colors">
                    {/* Tracking # */}
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                      #{s._id?.slice(-8).toUpperCase()}
                    </td>
                    {/* Shipper */}
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      <ShipperCell shipper={s.shipper} />
                    </td>
                    {/* Driver */}
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      <DriverCell driver={s.driver} />
                    </td>
                    {/* Route */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1 text-xs">
                        {s.pickupLocation?.city}
                        <ArrowRight size={10} className="text-[var(--color-text-secondary)]" />
                        {s.deliveryLocation?.city}
                      </span>
                    </td>
                    {/* Goods / Weight */}
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {s.goodsType} · {s.weight} kg
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge label={formatStatus(s.status)} variant={getStatusVariant(s.status)} />
                    </td>
                    {/* Payment */}
                    <td className="px-4 py-3">
                      <Badge
                        label={s.paymentStatus ?? 'unpaid'}
                        variant={paymentVariant(s.paymentStatus)}
                      />
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatDate(s.createdAt)}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Assign Driver — only for pending shipments */}
                        {s.status === 'pending' && (
                          <Button
                            id={`assign-driver-${s._id}`}
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigate(`/admin/assign-driver?shipmentId=${s._id}`)
                            }
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => fetchShipments(page - 1)}
            onNext={() => fetchShipments(page + 1)}
          />
        </Card>
      )}

      {/* ── Skeleton ── */}
      {loading && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-[var(--color-border)]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <SkeletonRow key={n} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

/**
 * ShipmentList.jsx
 * Full listing of the shipper's shipments with filter pills, search, and a rich table.
 *
 * Data: GET /api/shipments/my  (supports ?status= filter via backend)
 * Search: client-side by deliveryLocation.city or _id suffix
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  RefreshCw,
  Package,
  Copy,
  Check,
} from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import EmptyState      from '../../components/ui/EmptyState';

import { getMyShipments }                        from '../../api/shipmentApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';

// ── Status filter pills ───────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Pending',    value: 'pending' },
  { label: 'Assigned',   value: 'assigned' },
  { label: 'Picked Up',  value: 'picked_up' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
  { label: 'Cancelled',  value: 'cancelled' },
];

// ── Payment status badge ──────────────────────────────────────────────────────
const PAYMENT_VARIANT = { unpaid: 'danger', paid: 'success', failed: 'warning' };
const PAYMENT_LABEL   = { unpaid: 'Unpaid', paid: 'Paid', failed: 'Failed' };

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  const widths = ['w-24', 'w-20', 'w-20', 'w-16', 'w-12', 'w-16', 'w-16', 'w-20', 'w-14'];
  return (
    <tr className="border-b border-[var(--color-border)]">
      {widths.map((w, i) => (
        <td key={i} className="py-3 px-3">
          <div className={`h-4 rounded bg-gray-200 animate-pulse ${w}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Copy-to-clipboard cell ────────────────────────────────────────────────────
function CopyCell({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span className="group flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-secondary)]">
      #{text.slice(-8).toUpperCase()}
      <button
        onClick={handle}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[var(--color-primary)]"
        title="Copy ID"
      >
        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      </button>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShipmentList() {
  const navigate = useNavigate();

  const [shipments,      setShipments]      = useState([]);
  const [activeFilter,   setActiveFilter]   = useState('');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');

  // ── Fetch (re-fetches when filter changes — backend supports ?status=) ─────
  const fetchShipments = useCallback(async (statusFilter = activeFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res    = await getMyShipments(params);
      setShipments(res.data.data.shipments ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load shipments.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { fetchShipments(activeFilter); }, [activeFilter]); // eslint-disable-line

  // ── Filter pill click ──────────────────────────────────────────────────────
  const handleFilterClick = (value) => {
    setSearchQuery('');
    setActiveFilter(value);
  };

  // ── Client-side search (city or ID) ───────────────────────────────────────
  const displayed = searchQuery.trim()
    ? shipments.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          s.deliveryLocation?.city?.toLowerCase().includes(q) ||
          s.pickupLocation?.city?.toLowerCase().includes(q) ||
          s._id.slice(-8).toLowerCase().includes(q) ||
          s.goodsType?.toLowerCase().includes(q)
        );
      })
    : shipments;

  const TABLE_COLS = [
    'Tracking #', 'Pickup City', 'Delivery City',
    'Goods Type', 'Weight', 'Status', 'Payment', 'Date', 'Action',
  ];

  return (
    <DashboardLayout>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="My Shipments"
        subtitle={
          loading ? 'Loading…' : `${shipments.length} total shipment${shipments.length !== 1 ? 's' : ''}`
        }
        actions={
          <Button variant="primary" size="md" onClick={() => navigate('/shipper/shipments/create')}>
            <PlusCircle size={16} />
            New Shipment
          </Button>
        }
      />

      {/* ── Filter + Search bar ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterClick(f.value)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                activeFilter === f.value
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search box */}
        <div className="relative w-full sm:w-64">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search by city, goods, ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {error && !loading && (
        <Card className="mb-4 border-red-200 bg-red-50" padding="md">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchShipments()}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        </Card>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {!error && (
        <Card padding="sm">
          {!loading && displayed.length === 0 ? (
            <EmptyState
              icon={<Package size={28} />}
              title={searchQuery ? 'No matching shipments' : 'No shipments found'}
              description={
                searchQuery
                  ? 'Try a different search term or clear the filter.'
                  : 'Create your first shipment to get started.'
              }
              actionLabel={searchQuery ? undefined : 'Create Shipment'}
              onAction={searchQuery ? undefined : () => navigate('/shipper/shipments/create')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {TABLE_COLS.map((col) => (
                      <th
                        key={col}
                        className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                    : displayed.map((s) => (
                        <tr
                          key={s._id}
                          onClick={() => navigate(`/shipper/shipments/${s._id}`)}
                          className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          {/* Tracking # */}
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <CopyCell text={s._id} />
                          </td>
                          {/* Pickup city */}
                          <td className="py-3 px-3 text-[var(--color-text-primary)] whitespace-nowrap">
                            {s.pickupLocation?.city ?? '—'}
                          </td>
                          {/* Delivery city */}
                          <td className="py-3 px-3 text-[var(--color-text-primary)] whitespace-nowrap">
                            {s.deliveryLocation?.city ?? '—'}
                          </td>
                          {/* Goods type */}
                          <td className="py-3 px-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {s.goodsType ?? '—'}
                          </td>
                          {/* Weight */}
                          <td className="py-3 px-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {s.weight != null ? `${s.weight} kg` : '—'}
                          </td>
                          {/* Status */}
                          <td className="py-3 px-3">
                            <Badge
                              label={formatStatus(s.status)}
                              variant={getStatusVariant(s.status)}
                            />
                          </td>
                          {/* Payment status */}
                          <td className="py-3 px-3">
                            <Badge
                              label={PAYMENT_LABEL[s.paymentStatus] ?? s.paymentStatus ?? '—'}
                              variant={PAYMENT_VARIANT[s.paymentStatus] ?? 'default'}
                            />
                          </td>
                          {/* Date */}
                          <td className="py-3 px-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
                            {formatDate(s.createdAt)}
                          </td>
                          {/* View action */}
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/shipper/shipments/${s._id}`)}
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

      {/* Note: Backend returns all records at once — no pagination needed */}
    </DashboardLayout>
  );
}

/**
 * AssignDriver.jsx
 * Assign a driver to a pending shipment.
 *
 * Reads shipmentId from ?shipmentId= query param (useSearchParams).
 * Data:
 *   - Shipment: GET /api/admin/shipments/:id (getAdminShipmentById)
 *   - Drivers:  GET /api/admin/drivers (getAllDrivers — active only, { _id, name, email })
 * Action:
 *   - PATCH /api/admin/shipments/:id/assign — body: { driverId }
 *   - Backend enforces status must be 'pending'
 *   - On success: brief success message → navigate to /admin/shipments after 1.5s
 *
 * Handles:
 *   - Missing shipmentId param → error card with back button
 *   - Shipment already has a driver → warning card shown above form (form still usable)
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Navigation, Package, ChevronRight, CheckCircle2 } from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Badge           from '../../components/ui/Badge';
import Button          from '../../components/ui/Button';
import Spinner         from '../../components/ui/Spinner';
import { getAdminShipmentById, getAllDrivers, assignDriver } from '../../api/adminApi';
import { formatDate, formatStatus, getStatusVariant } from '../../utils/formatters';
import { getInitials } from '../../utils/formatters';

// ── Driver list item ──────────────────────────────────────────────────────────
function DriverCard({ driver, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(driver._id)}
      className={[
        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer',
        'transition-all duration-150',
        selected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] ring-1 ring-[var(--color-primary)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]',
      ].join(' ')}
    >
      {/* Avatar */}
      <div
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          selected
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
        ].join(' ')}
      >
        {getInitials(driver.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {driver.name}
        </p>
        <p className="truncate text-xs text-[var(--color-text-secondary)]">{driver.email}</p>
      </div>
      {selected && (
        <CheckCircle2 size={18} className="shrink-0 text-[var(--color-primary)]" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssignDriver() {
  const [searchParams]       = useSearchParams();
  const navigate             = useNavigate();
  const shipmentId           = searchParams.get('shipmentId');

  const [shipment,    setShipment]    = useState(null);
  const [drivers,     setDrivers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState(null);

  const [driverSearch,     setDriverSearch]     = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [assigning,        setAssigning]        = useState(false);
  const [assignError,      setAssignError]      = useState(null);
  const [assignSuccess,    setAssignSuccess]    = useState(false);

  // ── Fetch shipment + drivers in parallel ──────────────────────────────────
  useEffect(() => {
    if (!shipmentId) { setLoading(false); return; }

    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const [sRes, dRes] = await Promise.all([
          getAdminShipmentById(shipmentId),
          getAllDrivers(),
        ]);
        if (!cancelled) {
          setShipment(sRes.data?.data?.shipment ?? null);
          setDrivers(dRes.data?.data?.drivers ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err?.response?.data?.message ?? 'Failed to load data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [shipmentId]);

  // ── Filtered driver list ──────────────────────────────────────────────────
  const filteredDrivers = driverSearch.trim()
    ? drivers.filter((d) =>
        d.name.toLowerCase().includes(driverSearch.toLowerCase())
      )
    : drivers;

  // ── Assign action ─────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!selectedDriverId || !shipmentId) return;
    try {
      setAssigning(true);
      setAssignError(null);
      await assignDriver(shipmentId, selectedDriverId);
      setAssignSuccess(true);
      // Navigate back after 1.5s
      setTimeout(() => navigate('/admin/shipments'), 1500);
    } catch (err) {
      setAssignError(err?.response?.data?.message ?? 'Assignment failed. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // ── Guard: no shipmentId param ────────────────────────────────────────────
  if (!shipmentId) {
    return (
      <DashboardLayout>
        <PageHeader title="Assign Driver" />
        <Card className="border-red-200 bg-red-50">
          <p className="mb-4 text-sm text-red-700">
            No shipment selected. Please go back and choose a shipment to assign.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/shipments')}>
            ← Back to Shipments
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" color="var(--color-primary)" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <DashboardLayout>
        <PageHeader title="Assign Driver" />
        <Card className="border-red-200 bg-red-50">
          <p className="mb-4 text-sm text-red-700">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/shipments')}>
            ← Back to Shipments
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const hasDriver = !!shipment?.driver;

  return (
    <DashboardLayout>
      <PageHeader
        title="Assign Driver"
        subtitle={shipment ? `Shipment #${shipment._id?.slice(-8).toUpperCase()}` : 'Loading…'}
        actions={
          <Link
            to="/admin/shipments"
            className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
          >
            ← Back to Shipments
          </Link>
        }
      />

      {/* ── Already-assigned warning ── */}
      {hasDriver && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            ⚠️ This shipment already has a driver assigned:{' '}
            <strong>
              {typeof shipment.driver === 'object'
                ? shipment.driver.name
                : shipment.driver}
            </strong>
            . Assigning a new driver will replace them.
          </p>
        </Card>
      )}

      {/* ── Success state ── */}
      {assignSuccess && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Driver assigned successfully. Redirecting…
            </p>
          </div>
        </Card>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── LEFT: Shipment Summary ── */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            Shipment Summary
          </h2>

          {shipment ? (
            <div className="space-y-4">
              {/* Tracking + Status */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  #{shipment._id?.slice(-8).toUpperCase()}
                </span>
                <Badge
                  label={formatStatus(shipment.status)}
                  variant={getStatusVariant(shipment.status)}
                />
              </div>

              {/* Route */}
              <div className="rounded-lg bg-[var(--color-bg)] p-3 space-y-2">
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

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">Goods</p>
                  <p className="text-[var(--color-text-primary)]">{shipment.goodsType}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">Weight</p>
                  <p className="text-[var(--color-text-primary)]">{shipment.weight} kg</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">Shipper</p>
                  <p className="text-[var(--color-text-primary)]">
                    {typeof shipment.shipper === 'object' ? shipment.shipper?.name : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Current Driver
                  </p>
                  <p className={hasDriver ? 'text-[var(--color-text-primary)]' : 'text-amber-600 font-medium'}>
                    {hasDriver
                      ? (typeof shipment.driver === 'object' ? shipment.driver.name : shipment.driver)
                      : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">Created</p>
                  <p className="text-[var(--color-text-primary)]">{formatDate(shipment.createdAt)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Shipment data unavailable.</p>
          )}
        </Card>

        {/* ── RIGHT: Driver Selection ── */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            Select a Driver
          </h2>

          {/* Driver search */}
          <input
            id="driver-search"
            type="text"
            placeholder="Search drivers by name…"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />

          {/* Driver list */}
          {drivers.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
              No active drivers available.
            </p>
          ) : filteredDrivers.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
              No drivers match "{driverSearch}".
            </p>
          ) : (
            <div className="mb-4 max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredDrivers.map((d) => (
                <DriverCard
                  key={d._id}
                  driver={d}
                  selected={selectedDriverId === d._id}
                  onSelect={setSelectedDriverId}
                />
              ))}
            </div>
          )}

          {/* Assign button */}
          <Button
            id="assign-driver-confirm-btn"
            variant="primary"
            size="md"
            fullWidth
            disabled={!selectedDriverId || assignSuccess}
            loading={assigning}
            onClick={handleAssign}
          >
            Assign Driver
          </Button>

          {/* Inline assignment error */}
          {assignError && (
            <p className="mt-3 text-sm font-medium text-red-600">{assignError}</p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

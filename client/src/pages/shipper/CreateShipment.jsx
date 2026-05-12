/**
 * CreateShipment.jsx
 * Multi-section form to create a new shipment request.
 *
 * Exact backend body shape (from controller + validation middleware):
 * {
 *   pickupLocation:   { address, city, state, pincode }  ← required
 *   deliveryLocation: { address, city, state, pincode }  ← required
 *   goodsType:        string                             ← required
 *   weight:           number (> 0)                       ← required
 *   description:      string                             ← optional
 *   estimatedDelivery: ISO 8601 date string              ← optional
 * }
 *
 * Fields NOT in the model (omitted intentionally): dimensions, trackingNumber,
 * pricing — these do not exist on the Shipment schema.
 *
 * On success: navigates to /shipper/shipments/:id after 1.5s.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, CalendarClock, ChevronRight } from 'lucide-react';

import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader      from '../../components/shared/PageHeader';
import Card            from '../../components/ui/Card';
import Input           from '../../components/ui/Input';
import Select          from '../../components/ui/Select';
import Button          from '../../components/ui/Button';

import { createShipment } from '../../api/shipmentApi';

// ── Goods type options ────────────────────────────────────────────────────────
// No enum in model — free text field. Provide common options via Select.
const GOODS_TYPE_OPTIONS = [
  { label: 'Electronics',   value: 'Electronics'   },
  { label: 'Furniture',     value: 'Furniture'     },
  { label: 'Perishables',   value: 'Perishables'   },
  { label: 'Machinery',     value: 'Machinery'     },
  { label: 'Clothing',      value: 'Clothing'      },
  { label: 'Documents',     value: 'Documents'     },
  { label: 'Automotive',    value: 'Automotive'    },
  { label: 'Medical',       value: 'Medical'       },
  { label: 'Construction',  value: 'Construction'  },
  { label: 'Other',         value: 'Other'         },
];

// ── Initial form state ────────────────────────────────────────────────────────
const INITIAL_STATE = {
  pickupLocation: {
    address: '',
    city:    '',
    state:   '',
    pincode: '',
  },
  deliveryLocation: {
    address: '',
    city:    '',
    state:   '',
    pincode: '',
  },
  goodsType:         '',
  weight:            '',
  description:       '',
  estimatedDelivery: '',
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function FormSection({ icon: Icon, title, children }) {
  return (
    <Card padding="lg">
      <div className="mb-5 flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
          <Icon size={18} color="var(--color-primary)" />
        </div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

// ── Location field group ──────────────────────────────────────────────────────
function LocationFields({ prefix, formData, onChange, errors, disabled }) {
  return (
    <>
      <Input
        label="Street Address"
        name={`${prefix}.address`}
        placeholder="e.g. 123 Main Street"
        value={formData.address}
        onChange={onChange}
        error={errors[`${prefix}.address`]}
        required
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="City"
          name={`${prefix}.city`}
          placeholder="e.g. Mumbai"
          value={formData.city}
          onChange={onChange}
          error={errors[`${prefix}.city`]}
          required
          disabled={disabled}
        />
        <Input
          label="State"
          name={`${prefix}.state`}
          placeholder="e.g. Maharashtra"
          value={formData.state}
          onChange={onChange}
          error={errors[`${prefix}.state`]}
          required
          disabled={disabled}
        />
      </div>
      <Input
        label="Pincode"
        name={`${prefix}.pincode`}
        placeholder="e.g. 400001"
        value={formData.pincode}
        onChange={onChange}
        error={errors[`${prefix}.pincode`]}
        required
        disabled={disabled}
      />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CreateShipment() {
  const navigate = useNavigate();

  const [formData,    setFormData]    = useState(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);

  // ── Generic change handler — supports dot-notation for nested fields ─────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear the field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // ── Client-side validation ───────────────────────────────────────────────
  const validate = () => {
    const errs = {};

    // Pickup location
    if (!formData.pickupLocation.address.trim())
      errs['pickupLocation.address'] = 'Pickup address is required.';
    if (!formData.pickupLocation.city.trim())
      errs['pickupLocation.city'] = 'Pickup city is required.';
    if (!formData.pickupLocation.state.trim())
      errs['pickupLocation.state'] = 'Pickup state is required.';
    if (!formData.pickupLocation.pincode.trim())
      errs['pickupLocation.pincode'] = 'Pickup pincode is required.';

    // Delivery location
    if (!formData.deliveryLocation.address.trim())
      errs['deliveryLocation.address'] = 'Delivery address is required.';
    if (!formData.deliveryLocation.city.trim())
      errs['deliveryLocation.city'] = 'Delivery city is required.';
    if (!formData.deliveryLocation.state.trim())
      errs['deliveryLocation.state'] = 'Delivery state is required.';
    if (!formData.deliveryLocation.pincode.trim())
      errs['deliveryLocation.pincode'] = 'Delivery pincode is required.';

    // Cargo
    if (!formData.goodsType)
      errs['goodsType'] = 'Goods type is required.';
    if (!formData.weight)
      errs['weight'] = 'Weight is required.';
    else if (isNaN(formData.weight) || Number(formData.weight) <= 0)
      errs['weight'] = 'Weight must be a positive number.';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) {
      // Scroll to top so user sees first error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        pickupLocation:   formData.pickupLocation,
        deliveryLocation: formData.deliveryLocation,
        goodsType:        formData.goodsType,
        weight:           Number(formData.weight),
        ...(formData.description       && { description:       formData.description }),
        ...(formData.estimatedDelivery && { estimatedDelivery: formData.estimatedDelivery }),
      };

      const res      = await createShipment(payload);
      const newId    = res.data.data.shipment._id;

      setSuccess(true);

      // Navigate to the new shipment's detail page after a short delay
      setTimeout(() => {
        navigate(`/shipper/shipments/${newId}`, { replace: true });
      }, 1500);

    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to create shipment. Please try again.';
      setSubmitError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PageHeader
        title="Create Shipment"
        subtitle="Fill in the details below to request a new shipment"
        actions={
          <Link
            to="/shipper/shipments"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Shipments
          </Link>
        }
      />

      {/* ── Success banner ─────────────────────────────────────────────── */}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">
          ✅ Shipment created successfully! Redirecting to shipment details…
        </div>
      )}

      {/* ── Submit error banner ────────────────────────────────────────── */}
      {submitError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-[var(--color-danger)]"
        >
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Pickup + Delivery — 2-col on desktop ──────────────────────── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Section 1 — Pickup */}
          <FormSection icon={MapPin} title="Pickup Location">
            <LocationFields
              prefix="pickupLocation"
              formData={formData.pickupLocation}
              onChange={handleChange}
              errors={fieldErrors}
              disabled={loading || success}
            />
          </FormSection>

          {/* Section 2 — Delivery */}
          <FormSection icon={ChevronRight} title="Delivery Location">
            <LocationFields
              prefix="deliveryLocation"
              formData={formData.deliveryLocation}
              onChange={handleChange}
              errors={fieldErrors}
              disabled={loading || success}
            />
          </FormSection>
        </div>

        {/* ── Section 3 — Cargo Details (full width) ────────────────────── */}
        <div className="mb-6">
          <FormSection icon={Package} title="Cargo Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Goods Type *"
                name="goodsType"
                value={formData.goodsType}
                onChange={handleChange}
                options={GOODS_TYPE_OPTIONS}
                placeholder="Select goods type"
                error={fieldErrors['goodsType']}
                disabled={loading || success}
              />

              <Input
                label="Weight (kg)"
                name="weight"
                type="number"
                placeholder="e.g. 50"
                value={formData.weight}
                onChange={handleChange}
                error={fieldErrors['weight']}
                helperText="Enter weight in kilograms (must be > 0)."
                required
                disabled={loading || success}
              />
            </div>

            <Input
              label="Description"
              name="description"
              placeholder="Any special notes about the cargo (optional)"
              value={formData.description}
              onChange={handleChange}
              disabled={loading || success}
            />
          </FormSection>
        </div>

        {/* ── Section 4 — Schedule + Review ─────────────────────────────── */}
        <div className="mb-6">
          <FormSection icon={CalendarClock} title="Schedule & Review">
            <Input
              label="Estimated Delivery Date"
              name="estimatedDelivery"
              type="date"
              value={formData.estimatedDelivery}
              onChange={handleChange}
              helperText="Optional. Leave blank if unknown."
              disabled={loading || success}
            />

            {/* Read-only summary strip */}
            {(formData.pickupLocation.city || formData.deliveryLocation.city || formData.goodsType) && (
              <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-gray-50 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <p className="font-medium text-[var(--color-text-primary)] mb-1">Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {formData.pickupLocation.city && (
                    <span>📍 From: <strong>{formData.pickupLocation.city}</strong></span>
                  )}
                  {formData.deliveryLocation.city && (
                    <span>🏁 To: <strong>{formData.deliveryLocation.city}</strong></span>
                  )}
                  {formData.goodsType && (
                    <span>📦 Goods: <strong>{formData.goodsType}</strong></span>
                  )}
                  {formData.weight && (
                    <span>⚖️ Weight: <strong>{formData.weight} kg</strong></span>
                  )}
                </div>
              </div>
            )}
          </FormSection>
        </div>

        {/* ── Submit + Cancel ────────────────────────────────────────────── */}
        <div className="flex flex-col-reverse items-center justify-end gap-3 sm:flex-row">
          <Link
            to="/shipper/shipments"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading || success}
          >
            {success ? 'Shipment Created!' : 'Create Shipment'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}

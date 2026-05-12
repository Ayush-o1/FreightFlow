/**
 * Select.jsx
 * Accessible dropdown select with label, options, error, and placeholder.
 *
 * Props:
 *   label       — field label displayed above the select
 *   name        — HTML name attribute
 *   value       — controlled value
 *   onChange    — change handler
 *   options     — array of { label: string, value: string }
 *   error       — error message string
 *   placeholder — placeholder option text (disabled, first option)
 *   disabled    — bool
 */

import clsx from 'clsx';

export default function Select({
  label,
  name,
  value,
  onChange,
  options     = [],
  error,
  placeholder = 'Select an option',
  disabled    = false,
}) {
  const selectId = `select-${name}`;

  return (
    <div className="flex flex-col gap-1">
      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
      )}

      {/* Select element */}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={error ? `${selectId}-error` : undefined}
        aria-invalid={!!error}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm appearance-none',
          'transition-colors duration-150 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
          error
            ? 'border-[var(--color-danger)] bg-red-50'
            : 'border-[var(--color-border)] hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          !value && 'text-[var(--color-text-muted)]'
        )}
      >
        {/* Placeholder option */}
        <option value="" disabled hidden>
          {placeholder}
        </option>

        {/* Rendered options */}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Error message */}
      {error && (
        <p
          id={`${selectId}-error`}
          role="alert"
          className="text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

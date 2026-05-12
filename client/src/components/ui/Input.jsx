/**
 * Input.jsx
 * Accessible text input with label, error, and helper text support.
 *
 * Props:
 *   label       — field label displayed above the input
 *   name        — HTML name attribute (used by forms)
 *   type        — HTML input type (default 'text')
 *   placeholder — placeholder text
 *   value       — controlled value
 *   onChange    — change handler
 *   error       — error message string; shown below input in red
 *   required    — bool
 *   disabled    — bool
 *   helperText  — non-error hint shown below input in muted colour
 */

import clsx from 'clsx';

export default function Input({
  label,
  name,
  type       = 'text',
  placeholder,
  value,
  onChange,
  error,
  required   = false,
  disabled   = false,
  helperText,
}) {
  const inputId = `input-${name}`;

  return (
    <div className="flex flex-col gap-1">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--color-danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Input field */}
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined}
        aria-invalid={!!error}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm',
          'transition-colors duration-150',
          'placeholder:text-[var(--color-text-muted)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
          error
            ? 'border-[var(--color-danger)] bg-red-50'
            : 'border-[var(--color-border)] bg-white hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
        )}
      />

      {/* Error message */}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}

      {/* Helper text (only shown when no error) */}
      {!error && helperText && (
        <p
          id={`${inputId}-hint`}
          className="text-xs text-[var(--color-text-muted)]"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

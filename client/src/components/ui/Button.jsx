/**
 * Button.jsx
 * A reusable, fully accessible button component.
 *
 * Props:
 *   children    — button label / content
 *   variant     — 'primary' | 'secondary' | 'danger' | 'ghost'
 *   size        — 'sm' | 'md' | 'lg'
 *   loading     — bool — shows an inline spinner and disables the button
 *   disabled    — bool
 *   fullWidth   — bool — stretches to 100% of parent width
 *   onClick     — click handler
 *   type        — HTML button type ('button' | 'submit' | 'reset')
 */

import clsx from 'clsx';

// Inline spinner SVG shown during loading state
function Spinner({ size }) {
  const dim = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  return (
    <svg
      className="animate-spin"
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// Variant styles — reference design system colours via Tailwind arbitrary values
const variantStyles = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.98] shadow-sm',
  secondary:
    'bg-white text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-gray-50 active:scale-[0.98]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-red-700 active:scale-[0.98] shadow-sm',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-gray-100 active:scale-[0.98]',
};

// Size styles
const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2   text-sm rounded-lg gap-2',
  lg: 'px-6 py-3   text-base rounded-lg gap-2.5',
};

export default function Button({
  children,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  onClick,
  type      = 'button',
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        // Base styles
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-150 ease-in-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
        // Variant + size
        variantStyles[variant] ?? variantStyles.primary,
        sizeStyles[size] ?? sizeStyles.md,
        // State modifiers
        fullWidth && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none'
      )}
    >
      {loading && <Spinner size={size} />}
      {children}
    </button>
  );
}

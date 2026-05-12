/**
 * Badge.jsx
 * Small pill-shaped label used for status indicators.
 *
 * Props:
 *   label   — text to display inside the badge
 *   variant — 'success' | 'warning' | 'danger' | 'info' | 'default'
 */

import clsx from 'clsx';

const variantStyles = {
  success: 'bg-green-100  text-green-700  border-green-200',
  warning: 'bg-amber-100  text-amber-700  border-amber-200',
  danger:  'bg-red-100    text-red-700    border-red-200',
  info:    'bg-blue-100   text-blue-700   border-blue-200',
  default: 'bg-gray-100   text-gray-600   border-gray-200',
};

export default function Badge({ label, variant = 'default' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5',
        'text-xs font-medium rounded-full border',
        'whitespace-nowrap',
        variantStyles[variant] ?? variantStyles.default
      )}
    >
      {label}
    </span>
  );
}

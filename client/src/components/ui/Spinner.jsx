/**
 * Spinner.jsx
 * Animated circular SVG spinner for loading states.
 *
 * Props:
 *   size  — 'sm' (16px) | 'md' (24px) | 'lg' (40px)
 *   color — any valid CSS colour string (default: current text colour)
 */

import clsx from 'clsx';

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 40,
};

export default function Spinner({ size = 'md', color = 'currentColor' }) {
  const dim = sizeMap[size] ?? sizeMap.md;

  return (
    <svg
      className={clsx('animate-spin', {
        'w-4 h-4': size === 'sm',
        'w-6 h-6': size === 'md',
        'w-10 h-10': size === 'lg',
      })}
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

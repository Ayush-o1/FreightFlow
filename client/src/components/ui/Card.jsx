/**
 * Card.jsx
 * A simple white container with border, radius, and shadow.
 * Used throughout the app as the primary surface component.
 *
 * Props:
 *   children   — content inside the card
 *   className  — additional Tailwind classes to merge in
 *   padding    — 'sm' | 'md' | 'lg'
 */

import clsx from 'clsx';

const paddingStyles = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export default function Card({ children, className, padding = 'md' }) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        'rounded-lg',
        'card-shadow',       // defined in index.css
        paddingStyles[padding] ?? paddingStyles.md,
        className
      )}
    >
      {children}
    </div>
  );
}

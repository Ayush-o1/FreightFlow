/**
 * EmptyState.jsx
 * Centered empty-state layout shown when lists or tables have no data.
 *
 * Props:
 *   icon        — React element (e.g. a Lucide icon) displayed at the top
 *   title       — main heading
 *   description — sub-text with more context
 *   actionLabel — text for the optional CTA button
 *   onAction    — click handler for the CTA button
 */

import Button from './Button';

export default function EmptyState({
  icon,
  title       = 'Nothing here yet',
  description = 'There is no data to display at the moment.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon wrapper */}
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-xs text-sm text-[var(--color-text-secondary)]">
        {description}
      </p>

      {/* Optional CTA */}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

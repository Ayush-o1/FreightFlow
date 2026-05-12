/**
 * PageHeader.jsx  (shared component)
 * Page-level header row with title, optional subtitle, and right-side action slot.
 *
 * Props:
 *   title     — page title string
 *   subtitle  — optional description below the title
 *   actions   — JSX slot — buttons or other controls shown on the right side
 */

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      {/* Left: Title + subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Action buttons or other controls */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

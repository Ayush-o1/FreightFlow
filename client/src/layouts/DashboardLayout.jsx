/**
 * DashboardLayout.jsx
 * Main application shell: responsive sidebar + fixed topbar + scrollable content.
 *
 * Sidebar behaviour:
 *   Mobile  (< 768px):   hidden by default; hamburger opens as left overlay.
 *   Tablet  (768–1023px): icon-only collapsed sidebar (64px wide, icons only).
 *   Desktop (≥ 1024px):  full sidebar (260px, icons + labels).
 *
 * Body scroll is locked while mobile overlay is open.
 * Logout button lives inside the sidebar on mobile; in the topbar on desktop.
 */

import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  Package,
  PackagePlus,
  Users,
  ClipboardList,
  UserCheck,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import Badge             from '../components/ui/Badge';
import NotificationBell  from '../components/shared/NotificationBell';
import ToastContainer    from '../components/shared/ToastContainer';
import { useAuth }       from '../hooks/useAuth';
import { getInitials }   from '../utils/formatters';
import { useSocketConnection } from '../socket/useSocket';

// ── Nav link definitions per role ────────────────────────────────────────────
const navConfig = {
  shipper: [
    { label: 'Dashboard',       to: '/shipper/dashboard',       icon: LayoutDashboard },
    { label: 'My Shipments',    to: '/shipper/shipments',        icon: Package },
    { label: 'Create Shipment', to: '/shipper/shipments/create', icon: PackagePlus },
  ],
  driver: [
    { label: 'Dashboard',      to: '/driver/dashboard',  icon: LayoutDashboard },
    { label: 'My Assignments', to: '/driver/shipments',  icon: ClipboardList },
  ],
  admin: [
    { label: 'Dashboard',     to: '/admin/dashboard',      icon: LayoutDashboard },
    { label: 'All Shipments', to: '/admin/shipments',      icon: Package },
    { label: 'Users',         to: '/admin/users',          icon: Users },
    { label: 'Assign Driver', to: '/admin/assign-driver',  icon: UserCheck },
  ],
};

// ── Sidebar NavLink — adapts to collapsed (tablet) vs expanded (desktop) ─────
function SidebarLink({ item, collapsed = false, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      title={item.label}
      className={({ isActive }) =>
        [
          'flex items-center rounded-lg text-sm font-medium',
          'transition-colors duration-150',
          collapsed
            ? 'justify-center p-2.5'
            : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-[var(--color-sidebar-active)] text-white border-l-2 border-white/40'
            : 'text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white',
        ].join(' ')
      }
    >
      <Icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Connect socket for the duration of the dashboard session.
  useSocketConnection();

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const role     = user?.role ?? 'shipper';
  const navItems = navConfig[role] ?? navConfig.shipper;

  const displayName     = user?.name ?? 'User';
  const displayInitials = getInitials(displayName);
  const displayRole     = role.charAt(0).toUpperCase() + role.slice(1);

  const closeSidebar = () => setSidebarOpen(false);

  // ── Shared sidebar nav content ────────────────────────────────────────────
  // collapsed=false → full (mobile overlay + desktop)
  // collapsed=true  → icon-only (tablet)
  const SidebarNav = ({ collapsed = false }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={[
          'flex h-16 shrink-0 items-center border-b border-slate-700',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-5',
        ].join(' ')}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]">
          <Truck size={16} color="white" />
        </div>
        {!collapsed && (
          <span
            className="text-base font-bold text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            FreightFlow
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className={['flex-1 overflow-y-auto py-4 space-y-0.5', collapsed ? 'px-1.5' : 'px-3'].join(' ')}>
        {navItems.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onClick={closeSidebar}
          />
        ))}
      </nav>

      {/* Bottom — user info + logout (full sidebar only) */}
      {!collapsed && (
        <div className="shrink-0 border-t border-slate-700 px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Logged in as</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-300 truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-slate-500 capitalize">{role}</p>
          </div>
          {/* Logout — visible on mobile overlay, hidden on desktop (topbar handles it) */}
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors lg:hidden"
            onClick={() => logout(navigate)}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}

      {/* Bottom — collapsed tablet: just a logout icon */}
      {collapsed && (
        <div className="shrink-0 border-t border-slate-700 py-3 px-1.5">
          <button
            title="Logout"
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            onClick={() => logout(navigate)}
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* ── Mobile overlay sidebar (< 768px) ─────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSidebar}
            aria-hidden="true"
          />
          {/* Sidebar panel */}
          <div
            className="relative z-50 flex w-[260px] flex-col"
            style={{ backgroundColor: 'var(--color-sidebar-bg)' }}
          >
            <button
              className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:text-white"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
            <SidebarNav collapsed={false} />
          </div>
        </div>
      )}

      {/* ── Tablet icon-only sidebar (768px – 1023px) ─────────────────────── */}
      <aside
        className="hidden md:flex lg:hidden flex-col shrink-0"
        style={{
          width: 'var(--sidebar-collapsed)',
          backgroundColor: 'var(--color-sidebar-bg)',
        }}
      >
        <SidebarNav collapsed={true} />
      </aside>

      {/* ── Desktop full sidebar (≥ 1024px) ──────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-col shrink-0"
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--color-sidebar-bg)',
        }}
      >
        <SidebarNav collapsed={false} />
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 lg:px-6"
          style={{ height: 'var(--topbar-height)' }}
        >
          {/* Left: hamburger (mobile only) + wordmark (mobile only) */}
          <div className="flex items-center gap-3">
            <button
              className="flex md:hidden items-center justify-center rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <span
              className="text-sm font-semibold text-[var(--color-text-primary)] md:hidden"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              FreightFlow
            </span>
          </div>

          {/* Right: role badge + bell + avatar + logout (desktop only) */}
          <div className="flex items-center gap-3">
            <Badge label={displayRole} variant="info" />
            <NotificationBell />

            {/* Avatar with initials */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white select-none"
              title={displayName}
            >
              {displayInitials}
            </div>

            {/* Logout — desktop only (mobile logout lives in sidebar) */}
            <button
              id="topbar-logout-btn"
              className="hidden lg:flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-gray-100 transition-colors active:scale-95"
              onClick={() => logout(navigate)}
              title="Log out"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page content — animate-fadeIn triggers on each page mount */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="animate-fadeIn">
            {children}
          </div>
        </main>
      </div>

      {/* Global toast overlay */}
      <ToastContainer />
    </div>
  );
}

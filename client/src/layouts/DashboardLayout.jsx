/**
 * DashboardLayout.jsx
 * Main application shell: fixed dark sidebar + fixed topbar + scrollable content.
 *
 * Phase 2 update: reads real user from AuthContext.
 *   - Nav links driven by user.role
 *   - Avatar shows real initials from user.name via getInitials()
 *   - Role badge shows user.role
 *   - Logout wired to logout(navigate) from AuthContext
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  Package,
  PackagePlus,
  Users,
  ClipboardList,
  UserCheck,
  BarChart3,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import Badge              from '../components/ui/Badge';
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
    { label: 'Reports',       to: '/admin/reports',        icon: BarChart3 },
  ],
};

// ── Sidebar NavLink component ─────────────────────────────────────────────────
function SidebarLink({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
          'transition-colors duration-150',
          isActive
            ? 'bg-[var(--color-sidebar-active)] text-white'
            : 'text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white',
        ].join(' ')
      }
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Connect socket for the duration of the dashboard session.
  // Disconnects automatically when user logs out (useEffect cleanup).
  useSocketConnection();

  // Derive nav links from real role; fall back to shipper if user is null
  const role     = user?.role ?? 'shipper';
  const navItems = navConfig[role] ?? navConfig.shipper;

  // User display values
  const displayName     = user?.name ?? 'User';
  const displayInitials = getInitials(displayName);
  const displayRole     = role.charAt(0).toUpperCase() + role.slice(1);

  const closeSidebar = () => setSidebarOpen(false);

  // ── Sidebar inner content ─────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-700 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
          <Truck size={16} color="white" />
        </div>
        <span
          className="text-base font-bold text-white"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          FreightFlow
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={closeSidebar} />
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="shrink-0 border-t border-slate-700 px-5 py-4">
        <p className="text-xs text-slate-500 uppercase tracking-widest">
          Logged in as
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-300 truncate" title={displayName}>
          {displayName}
        </p>
        <p className="text-xs text-slate-500 capitalize">{role}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* ── Mobile overlay sidebar ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSidebar}
            aria-hidden="true"
          />
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
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Desktop fixed sidebar ────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-col"
        style={{
          width: 'var(--sidebar-width)',
          minWidth: 'var(--sidebar-width)',
          backgroundColor: 'var(--color-sidebar-bg)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 lg:px-6"
          style={{ height: 'var(--topbar-height)' }}
        >
          {/* Left: hamburger + wordmark (mobile) */}
          <div className="flex items-center gap-3">
            <button
              className="flex lg:hidden items-center justify-center rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <span
              className="text-sm font-semibold text-[var(--color-text-primary)] lg:hidden"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              FreightFlow
            </span>
          </div>

          {/* Right: role badge + notification bell + avatar + logout */}
          <div className="flex items-center gap-3">
            <Badge label={displayRole} variant="info" />

            {/* Notification bell */}
            <NotificationBell />

            {/* Avatar with real initials */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white select-none"
              title={displayName}
            >
              {displayInitials}
            </div>

            {/* Logout button */}
            <button
              id="topbar-logout-btn"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-gray-100 transition-colors"
              onClick={() => logout(navigate)}
              title="Log out"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Global toast overlay — fixed position, renders above everything */}
      <ToastContainer />
    </div>
  );
}

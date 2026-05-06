import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Briefcase,
  ListTodo,
  ClipboardList,
  Clock,
  CheckSquare,
  Users,
  BarChart3,
  Settings,
  Sun,
  Moon,
  LogOut,
  Building2,
} from 'lucide-react';
import fitoutLogo from '../assets/fitoutos-logo.png';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'pm', 'project_manager', 'worker'] },
  { path: '/jobs', label: 'Jobs', icon: Briefcase, roles: ['admin', 'pm', 'project_manager', 'worker'] },
  { path: '/tasks', label: 'Tasks', icon: ListTodo, roles: ['admin', 'pm', 'project_manager', 'worker'] },
  { path: '/task-codes', label: 'Task Codes', icon: ClipboardList, roles: ['admin', 'pm', 'project_manager'] },
  { path: '/timesheets', label: 'Timesheets', icon: Clock, roles: ['admin', 'pm', 'project_manager', 'worker'] },
  { path: '/timesheets/approval', label: 'Approvals', icon: CheckSquare, roles: ['admin', 'pm', 'project_manager'] },
  { path: '/subcontractors', label: 'Subcontractors', icon: Users, roles: ['admin', 'pm', 'project_manager'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'pm', 'project_manager'] },
  { path: '/resource-analysis', label: 'Resources', icon: BarChart3, roles: ['admin', 'pm', 'project_manager'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

const suiteLinks = [
  {
    href: process.env.REACT_APP_LONG_LINE_DIARY_URL || 'http://localhost:3003/dashboard',
    label: 'LLD',
    description: 'Long Line Diary / Site diary',
  },
  {
    href: process.env.REACT_APP_TOOL_TRACKER_URL || 'http://localhost:3002/dashboard',
    label: 'Tool Tracker',
    description: 'Tool control',
  },
  {
    href: process.env.REACT_APP_TIMESHEET_MANAGER_URL || 'http://localhost:3001/login',
    label: 'Timesheet',
    description: 'Labour and payroll',
  },
];

const getDisplayName = (user) => user?.name || user?.full_name || user?.email || 'FitoutOS User';

const formatRole = (role) => {
  if (!role) return 'User';
  return role.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const currentRole = user?.role || 'worker';
  const filteredNavItems = navItems.filter(item => item.roles.includes(currentRole));

  const isActive = (path) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  const displayName = getDisplayName(user);
  const roleLabel = formatRole(user?.role);

  return (
    <div className="fo-app-shell" data-testid="fitoutos-layout">
      <nav className="fo-top-nav">
        <div className="fo-top-nav-inner">
          <div className="fo-nav-left">
            <NavLink to="/dashboard" className="fo-brand-link fo-top-brand-link" data-testid="logo-link">
              <span className="fo-brand-logo">
                <img src={fitoutLogo} alt="FitoutOS logo" />
              </span>
              <span className="fo-brand-copy">
                <span className="fo-brand-kicker">Long Line</span>
                <span className="fo-brand-title">FitoutOS</span>
                <span className="fo-brand-subtitle">Programme & Labour Control</span>
              </span>
            </NavLink>

            <div className="fo-desktop-nav">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`fo-nav-link ${isActive(item.path) ? 'active' : ''}`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}

              <div className="fo-nav-divider" aria-hidden="true" />

              {suiteLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="fo-suite-link"
                  title={item.description}
                  data-testid={`suite-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Building2 className="h-4 w-4" />
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="fo-nav-user">
            <button
              type="button"
              onClick={toggleTheme}
              className="fo-theme-toggle"
              data-testid="theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <span className="fo-user-block" data-testid="user-name">
              <span className="fo-user-name">{displayName}</span>
              <span className="fo-user-role">{roleLabel}</span>
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="fo-logout-button"
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        <div className="fo-mobile-nav">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`fo-mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}

          {suiteLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="fo-mobile-suite-link"
              data-testid={`mobile-suite-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="fo-shell-grid">
        <aside className="fo-desktop-brand-rail" aria-label="FitoutOS navigation panel">
          <div className="fo-rail-card">
            <img src={fitoutLogo} alt="FitoutOS logo" className="fo-rail-logo" />
            <div className="fo-rail-copy">
              <span className="fo-rail-kicker">Long Line</span>
              <span className="fo-rail-title">FitoutOS</span>
              <span className="fo-rail-subtitle">Programme & Labour Control</span>
            </div>
          </div>

          <nav className="fo-rail-nav" aria-label="FitoutOS main navigation">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`fo-rail-nav-link ${isActive(item.path) ? 'active' : ''}`}
                  data-testid={`rail-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="fo-rail-suite" aria-label="Long Line Suite apps">
            <p className="fo-rail-suite-title">Long Line Suite</p>
            <div className="fo-rail-suite-links">
              {suiteLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="fo-rail-suite-link"
                  title={item.description}
                  data-testid={`rail-suite-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="fo-rail-account" aria-label="FitoutOS account controls">
            <p className="fo-rail-suite-title">Account</p>

            <div className="fo-rail-user-block" data-testid="rail-user-name">
              <span className="fo-rail-user-name">{displayName}</span>
              <span className="fo-rail-user-role">{roleLabel}</span>
            </div>

            <div className="fo-rail-account-actions">
              <button
                type="button"
                onClick={toggleTheme}
                className="fo-rail-theme-toggle"
                data-testid="rail-theme-toggle"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="fo-rail-logout-button"
                data-testid="rail-logout-btn"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="fo-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

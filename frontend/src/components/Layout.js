import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { path: '/resource-analysis', label: 'Resource Analysis', icon: BarChart3, roles: ['admin', 'pm', 'project_manager'] },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-card border-r border-border z-50",
          "transform transition-all duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          sidebarCollapsed ? "md:w-14" : "w-56"
        )}
      >
        <div className={cn(
          "h-16 flex items-center border-b border-border px-3",
          sidebarCollapsed && "md:justify-center md:px-2"
        )}>
          <img src={fitoutLogo} alt="FitoutOS logo" className="h-9 w-9 object-contain flex-shrink-0" />
          {!sidebarCollapsed && (
            <span className="ml-3 text-xl font-bold font-['Manrope']">FitoutOS</span>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden p-2 hover:bg-accent rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : "text-muted-foreground",
                sidebarCollapsed && "md:justify-center md:px-2"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex absolute bottom-4 right-0 translate-x-1/2 items-center justify-center w-6 h-6 rounded-full bg-card border border-border shadow-sm hover:bg-accent"
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            sidebarCollapsed && "rotate-180"
          )} />
        </button>
      </aside>

      <div className={cn(
        "min-h-screen transition-all duration-200",
        sidebarCollapsed ? "md:ml-14" : "md:ml-56"
      )}>
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-accent rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="user-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive" data-testid="logout-btn">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="p-3 md:p-4 lg:p-5">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
        <div className="flex items-center justify-around py-2">
          {filteredNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-md min-w-[60px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Plus, 
  History, 
  Bell,
  Users,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { isManager, isAdmin, isOperator } = useAuth();

  // Navigation pour les exploitants
  const operatorNavigation = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Catalogue pièces', href: '/stock', icon: Package },
    { name: 'Mes demandes', href: '/requests', icon: FileText },
    { name: 'Nouvelle demande', href: '/requests/new', icon: Plus },
    { name: 'Mes signalements', href: '/reports', icon: AlertTriangle },
  ];

  // Navigation pour les responsables maintenance (pas de création de demande)
  const managerNavigation = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Catalogue pièces', href: '/stock', icon: Package },
    { name: 'Toutes les demandes', href: '/requests', icon: FileText },
    { name: 'Signalements', href: '/reports', icon: AlertTriangle },
    { name: 'Historique', href: '/history', icon: History },
  ];

  // Navigation pour les admins
  const adminNavigation = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Catalogue pièces', href: '/stock', icon: Package },
    { name: 'Demandes', href: '/requests', icon: FileText },
    { name: 'Signalements', href: '/reports', icon: AlertTriangle },
    { name: 'Historique', href: '/history', icon: History },
  ];

  // Sélectionner la navigation appropriée selon le rôle
  let navigation = operatorNavigation;
  if (isAdmin) {
    navigation = adminNavigation;
  } else if (isManager) {
    navigation = managerNavigation;
  }

  // Administration (admin uniquement)
  const adminSection = isAdmin ? [
    { name: 'Utilisateurs', href: '/admin/users', icon: Users },
    { name: 'Gestion catalogue', href: '/admin/parts', icon: Package },
    { name: 'Réinitialisation', href: '/admin/reset', icon: RotateCcw },
  ] : [];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
         <img
            src="/logo.png"
            alt="logo"
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">GPDR</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestion Pièces de Rechange</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-sidebar-primary')} />
                {item.name}
              </Link>
            );
          })}

          {/* Admin section */}
          {adminSection.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              {adminSection.map((item) => {
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', isActive && 'text-sidebar-primary')} />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Link
            to="/notifications"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <Badge variant="warning" className="h-5 min-w-5 justify-center">
                {unreadCount}
              </Badge>
            )}
          </Link>
        </div>
      </div>
    </aside>
  );
}

import { Search, Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Link, useNavigate } from 'react-router-dom';

const roleLabels: Record<string, string> = {
  operator: 'Exploitant',
  maintenance_manager: 'Resp. Maintenance',
  admin: 'Administrateur',
};

export function Header() {
  const { user, profile, roles, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : user?.email || 'Utilisateur';

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : user?.email?.[0]?.toUpperCase() || 'U';

  const primaryRole = roles[0] || 'operator';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-6">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Rechercher..." className="pl-10 bg-secondary/50" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 justify-center p-0 text-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && <Badge variant="secondary">{unreadCount} non lues</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recentNotifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Aucune notification</div>
            ) : (
              <>
                {recentNotifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    onClick={() => {
                      if (!notification.is_read) markAsRead(notification.id);
                      if (notification.entity_type === 'request' && notification.entity_id) {
                        navigate(`/requests/${notification.entity_id}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className={`font-medium text-sm ${!notification.is_read ? 'text-primary' : ''}`}>
                        {notification.title}
                      </span>
                      {!notification.is_read && <span className="h-2 w-2 rounded-full bg-primary ml-auto" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{notification.message}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="w-full text-center text-sm text-primary">Voir toutes les notifications</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left hidden md:flex">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{roleLabels[primaryRole] || primaryRole}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2"><User className="h-4 w-4" />Mon profil</DropdownMenuItem>
            <DropdownMenuItem className="gap-2"><Settings className="h-4 w-4" />Préférences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

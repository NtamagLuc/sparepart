import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, string> = {
  request_created: '📝',
  request_approved: '✅',
  request_rejected: '❌',
  stock_low: '⚠️',
  part_non_conform: '🚫',
  role_assigned: '👤',
  report_submitted: '⚠️',
};

export default function Notifications() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 
              ? `${unreadCount} notification(s) non lue(s)`
              : 'Toutes les notifications sont lues'
            }
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Notifications list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Toutes les notifications
          </CardTitle>
          <CardDescription>
            {notifications.length} notification(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification, index) => {
                const entityPath = notification.entity_type === 'request' 
                  ? `/requests/${notification.entity_id}`
                  : notification.entity_type === 'part'
                  ? `/stock/${notification.entity_id}`
                  : notification.entity_type === 'report'
                  ? `/reports`
                  : null;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg transition-colors animate-fade-in cursor-pointer",
                      notification.is_read 
                        ? "bg-secondary/30" 
                        : "bg-primary/5 border border-primary/10 hover:bg-primary/10"
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => {
                      if (!notification.is_read) markAsRead(notification.id);
                    }}
                  >
                    <span className="text-2xl">
                      {notificationIcons[notification.type] || '📢'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          !notification.is_read && "text-primary"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      {entityPath && (
                        <Link 
                          to={entityPath}
                          className="text-sm text-primary hover:underline mt-2 inline-block"
                        >
                          Voir les détails →
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(notification.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

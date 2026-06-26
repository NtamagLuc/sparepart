import { useState, useEffect } from 'react';
import { 
  History as HistoryIcon, 
  Search,
  FileText,
  Package,
  User,
  AlertTriangle,
  Loader2,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExcelExport } from '@/components/ExcelExport';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
type EntityType = Database['public']['Enums']['entity_type'];

const entityTypeLabels: Record<EntityType, { label: string; icon: React.ElementType }> = {
  request: { label: 'Demande', icon: FileText },
  part: { label: 'Pièce', icon: Package },
  user: { label: 'Utilisateur', icon: User },
  report: { label: 'Signalement', icon: AlertTriangle },
  stock: { label: 'Stock', icon: Package },
};

export default function History() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    
    return matchesSearch && matchesEntity;
  });

  const handleClearHistory = async () => {
    setIsClearing(true);
    
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    setIsClearing(false);
    setShowClearDialog(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de vider l\'historique.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Historique vidé',
      description: 'L\'historique des activités a été réinitialisé.',
    });
    
    setLogs([]);
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Historique</h1>
          <p className="text-muted-foreground mt-1">
            Journal des actions et modifications du système
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <ExcelExport type="history" />}
          {isAdmin && logs.length > 0 && (
            <Button 
              variant="destructive" 
              className="gap-2"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Vider
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans l'historique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="request">Demandes</SelectItem>
                <SelectItem value="part">Pièces</SelectItem>
                <SelectItem value="user">Utilisateurs</SelectItem>
                <SelectItem value="report">Signalements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            Journal d'activité
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} entrée(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HistoryIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucune activité enregistrée</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => {
                const entityConfig = entityTypeLabels[log.entity_type];
                const EntityIcon = entityConfig?.icon || FileText;
                
                // Extract details from old_values and new_values
                const oldValues = log.old_values as Record<string, unknown> | null;
                const newValues = log.new_values as Record<string, unknown> | null;
                
                return (
                  <div 
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <EntityIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{log.action}</p>
                        <Badge variant="secondary" className="text-xs">
                          {entityConfig?.label || log.entity_type}
                        </Badge>
                      </div>
                      {newValues && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {newValues.request_number && `N° ${newValues.request_number}`}
                          {newValues.code && `Code: ${newValues.code}`}
                          {newValues.name && ` - ${newValues.name}`}
                          {newValues.rejection_reason && ` - Motif: ${newValues.rejection_reason}`}
                          {newValues.role && ` - Rôle: ${newValues.role}`}
                          {newValues.target_user && ` à ${newValues.target_user}`}
                        </p>
                      )}
                      {oldValues?.quantity !== undefined && newValues?.quantity !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="text-destructive">{String(oldValues.quantity)}</span>
                          {' → '}
                          <span className="text-success">{String(newValues.quantity)}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{log.user_name || 'Système'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear History Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider l'historique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement tout l'historique des activités.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

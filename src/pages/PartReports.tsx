import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Search, 
  Plus,
  Eye,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReportStatusBadge } from '@/components/ReportStatusBadge';
import { ExcelExport } from '@/components/ExcelExport';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type PartReport = Database['public']['Tables']['part_reports']['Row'];
type ReportStatus = Database['public']['Enums']['report_status'];

interface ReportWithDetails extends PartReport {
  spare_parts: {
    code: string;
    name: string;
  } | null;
  reporter_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const issueTypeLabels: Record<string, string> = {
  damaged: 'Endommagée',
  defective: 'Défectueuse',
  wrong_reference: 'Mauvaise référence',
  other: 'Autre',
};

export default function PartReports() {
  const { user, isManager, isOperator, isAdmin } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog state for manager actions
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [newStatus, setNewStatus] = useState<ReportStatus>('in_progress');
  const [resolutionComment, setResolutionComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchReports = async () => {
    setIsLoading(true);

    const { data: reportsData, error } = await supabase
      .from('part_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      setIsLoading(false);
      return;
    }

    // Fetch part and reporter details
    const partIds = [...new Set(reportsData?.map(r => r.part_id) || [])];
    const reporterIds = [...new Set(reportsData?.map(r => r.reporter_id) || [])];

    const { data: partsData } = await supabase
      .from('spare_parts')
      .select('id, code, name')
      .in('id', partIds);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', reporterIds);

    const reportsWithDetails: ReportWithDetails[] = (reportsData || []).map(report => ({
      ...report,
      spare_parts: partsData?.find(p => p.id === report.part_id) || null,
      reporter_profile: profilesData?.find(p => p.id === report.reporter_id) || null,
    }));

    setReports(reportsWithDetails);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.spare_parts?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.spare_parts?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleOpenStatusDialog = (report: ReportWithDetails) => {
    setSelectedReport(report);
    setNewStatus(report.status === 'pending' ? 'in_progress' : 'resolved');
    setResolutionComment('');
    setShowStatusDialog(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;

    setIsUpdating(true);

    const updateData: Partial<PartReport> = {
      status: newStatus,
      resolution_comment: resolutionComment || null,
    };

    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = user?.id;
    }

    const { error } = await supabase
      .from('part_reports')
      .update(updateData)
      .eq('id', selectedReport.id);

    setIsUpdating(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Statut mis à jour',
      description: `Le signalement a été marqué comme "${issueTypeLabels[newStatus] || newStatus}".`,
    });

    setShowStatusDialog(false);
    fetchReports();
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
          <h1 className="text-3xl font-bold tracking-tight">Signalements</h1>
          <p className="text-muted-foreground mt-1">
            {isOperator ? 'Mes signalements de pièces' : 'Tous les signalements de pièces'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOperator && (
            <Button asChild variant="accent" className="gap-2">
              <Link to="/reports/new">
                <Plus className="h-4 w-4" />
                Signaler une pièce
              </Link>
            </Button>
          )}
          {isAdmin && <ExcelExport type="reports" />}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par pièce ou description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="resolved">Résolu</SelectItem>
                <SelectItem value="closed">Fermé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Liste des signalements
          </CardTitle>
          <CardDescription>
            {filteredReports.length} signalement(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun signalement trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Type de problème</TableHead>
                  <TableHead>Description</TableHead>
                  {isManager && <TableHead>Signalé par</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  {isManager && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report, index) => {
                  const reporterName = report.reporter_profile
                    ? `${report.reporter_profile.first_name || ''} ${report.reporter_profile.last_name || ''}`.trim() || 'Utilisateur'
                    : 'Utilisateur';

                  return (
                    <TableRow 
                      key={report.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <Link to={`/stock/${report.part_id}`} className="hover:underline">
                          <div>
                            <p className="font-medium text-primary">{report.spare_parts?.name || 'Pièce inconnue'}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {report.spare_parts?.code || '-'}
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {issueTypeLabels[report.issue_type] || report.issue_type}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate text-sm text-muted-foreground">
                          {report.description}
                        </p>
                      </TableCell>
                      {isManager && (
                        <TableCell className="text-sm">
                          {reporterName}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(report.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <ReportStatusBadge status={report.status} />
                      </TableCell>
                      {isManager && (
                        <TableCell>
                          {report.status !== 'closed' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleOpenStatusDialog(report)}
                            >
                              {report.status === 'pending' ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut du signalement</DialogTitle>
            <DialogDescription>
              Pièce: {selectedReport?.spare_parts?.name || 'Inconnue'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau statut</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ReportStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours de traitement</SelectItem>
                  <SelectItem value="resolved">Résolu</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commentaire de résolution</Label>
              <Textarea
                placeholder="Décrivez les actions prises..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Mettre à jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

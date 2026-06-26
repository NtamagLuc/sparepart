import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Loader2,
  Flag,
  XCircle,
  ShieldCheck,
  ShieldX,
  PercentCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { ReportStatusBadge } from '@/components/ReportStatusBadge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type PartRequest = Database['public']['Tables']['part_requests']['Row'];
type PartReport = Database['public']['Tables']['part_reports']['Row'];

interface RequestWithPart extends PartRequest {
  spare_parts: {
    code: string;
    name: string;
    unit: string;
  } | null;
  requester_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface ReportWithPart extends PartReport {
  spare_parts: {
    code: string;
    name: string;
  } | null;
  reporter_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export default function Dashboard() {
  const { user, isManager, isAdmin, isOperator } = useAuth();
  const [parts, setParts] = useState<SparePart[]>([]);
  const [requests, setRequests] = useState<RequestWithPart[]>([]);
  const [reports, setReports] = useState<ReportWithPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);

      // Fetch spare parts
      const { data: partsData } = await supabase
        .from('spare_parts')
        .select('*');

      // Fetch requests - filtered by role
      let requestsQuery = supabase
        .from('part_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Operators only see their own requests
      if (isOperator && !isManager && !isAdmin) {
        requestsQuery = requestsQuery.eq('requester_id', user.id);
      }

      const { data: requestsData } = await requestsQuery;

      // Fetch reports - filtered by role
      let reportsQuery = supabase
        .from('part_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (isOperator && !isManager && !isAdmin) {
        reportsQuery = reportsQuery.eq('reporter_id', user.id);
      }

      const { data: reportsData } = await reportsQuery;

      // Fetch profiles for requests
      const requesterIds = [...new Set(requestsData?.map(r => r.requester_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', requesterIds);

      // Fetch parts for requests
      const partIds = [...new Set([
        ...(requestsData?.map(r => r.part_id) || []),
        ...(reportsData?.map(r => r.part_id) || [])
      ])];
      const { data: requestPartsData } = await supabase
        .from('spare_parts')
        .select('id, code, name, unit')
        .in('id', partIds);

      // Fetch profiles for reports
      const reporterIds = [...new Set(reportsData?.map(r => r.reporter_id) || [])];
      const { data: reporterProfilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', reporterIds);

      // Combine requests with details
      const requestsWithDetails: RequestWithPart[] = (requestsData || []).map(request => ({
        ...request,
        spare_parts: requestPartsData?.find(p => p.id === request.part_id) || null,
        requester_profile: profilesData?.find(p => p.id === request.requester_id) || null,
      }));

      // Combine reports with details
      const reportsWithDetails: ReportWithPart[] = (reportsData || []).map(report => ({
        ...report,
        spare_parts: requestPartsData?.find(p => p.id === report.part_id) || null,
        reporter_profile: reporterProfilesData?.find(p => p.id === report.reporter_id) || null,
      }));

      setParts(partsData || []);
      setRequests(requestsWithDetails);
      setReports(reportsWithDetails);
      setIsLoading(false);
    };

    fetchData();
  }, [user, isOperator, isManager, isAdmin]);

  const lowStockParts = parts.filter(p => p.current_quantity <= p.minimum_quantity);
  const nonConformParts = parts.filter(p => p.is_non_conform);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');
  const pendingReports = reports.filter(r => r.status === 'pending');
  const recentRequests = requests.slice(0, 5);
  const recentReports = reports.slice(0, 5);

  // Conformity stats (for managers and admins)
  const conformRequests = requests.filter(r => (r as any).conformity === 'conform');
  const nonConformRequests = requests.filter(r => (r as any).conformity === 'non_conform');
  const totalWithConformity = conformRequests.length + nonConformRequests.length;
  const nonConformRate = totalWithConformity > 0 
    ? Math.round((nonConformRequests.length / totalWithConformity) * 100) 
    : 0;

  // Requests that the current manager can approve (not their own)
  const approvableRequests = pendingRequests.filter(r => 
    isManager && r.requester_id !== user?.id
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // OPERATOR DASHBOARD
  if (isOperator && !isManager && !isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Suivi de vos demandes et signalements
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/reports/new">
                <Flag className="h-4 w-4" />
                Signaler une pièce
              </Link>
            </Button>
            <Button asChild variant="accent" className="gap-2">
              <Link to="/requests/new">
                <FileText className="h-4 w-4" />
                Nouvelle demande
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Mes demandes en cours"
            value={pendingRequests.length}
            icon={Clock}
            variant={pendingRequests.length > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Demandes approuvées"
            value={approvedRequests.length}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Demandes rejetées"
            value={rejectedRequests.length}
            icon={XCircle}
            variant={rejectedRequests.length > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Mes signalements"
            value={reports.length}
            icon={Flag}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* My requests */}
          <Card className="animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mes dernières demandes</CardTitle>
                <CardDescription>Suivi de vos demandes de pièces</CardDescription>
              </div>
              <Button variant="ghost" asChild className="gap-1">
                <Link to="/requests">
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune demande pour le moment
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((request, index) => (
                    <Link
                      key={request.id}
                      to={`/requests/${request.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-primary">
                            {request.request_number}
                          </span>
                          <StatusBadge status={request.status} />
                        </div>
                        <p className="text-sm mt-1">{request.spare_parts?.name || 'Pièce'}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My reports */}
          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mes signalements</CardTitle>
                <CardDescription>État de vos signalements de pièces</CardDescription>
              </div>
              <Button variant="ghost" asChild className="gap-1">
                <Link to="/reports">
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun signalement pour le moment
                </div>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report, index) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div>
                        <p className="font-medium text-sm">{report.spare_parts?.name || 'Pièce'}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {report.spare_parts?.code}
                        </p>
                      </div>
                      <ReportStatusBadge status={report.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // MANAGER DASHBOARD
  if (isManager && !isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des demandes et signalements
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Demandes à traiter"
            value={approvableRequests.length}
            icon={Clock}
            variant={approvableRequests.length > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Signalements à traiter"
            value={pendingReports.length}
            icon={Flag}
            variant={pendingReports.length > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Stock critique"
            value={lowStockParts.length}
            icon={AlertTriangle}
            variant={lowStockParts.length > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Demandes validées"
            value={approvedRequests.length}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Taux non-conformité"
            value={`${nonConformRate}%`}
            icon={ShieldX}
            variant={nonConformRate > 20 ? 'danger' : nonConformRate > 10 ? 'warning' : 'default'}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pending requests to approve */}
          <Card className="lg:col-span-2 animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Demandes en attente de validation</CardTitle>
                <CardDescription>Demandes à approuver ou rejeter</CardDescription>
              </div>
              <Button variant="ghost" asChild className="gap-1">
                <Link to="/requests">
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {approvableRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune demande en attente de validation
                </div>
              ) : (
                <div className="space-y-3">
                  {approvableRequests.slice(0, 5).map((request, index) => {
                    const requesterName = request.requester_profile
                      ? `${request.requester_profile.first_name || ''} ${request.requester_profile.last_name || ''}`.trim() || 'Utilisateur'
                      : 'Utilisateur';

                    return (
                      <Link
                        key={request.id}
                        to={`/requests/${request.id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-medium text-primary">
                              {request.request_number}
                            </span>
                            <UrgencyBadge urgency={request.urgency} />
                          </div>
                          <p className="mt-1 text-sm font-medium">
                            {request.spare_parts?.name || 'Pièce inconnue'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Par {requesterName} • {format(new Date(request.created_at), 'dd MMM yyyy', { locale: fr })}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar alerts */}
          <div className="space-y-6">
            {/* Reports to process */}
            <Card className="border-warning/30 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Flag className="h-5 w-5" />
                  Signalements récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun signalement en attente</p>
                ) : (
                  <div className="space-y-3">
                    {pendingReports.slice(0, 5).map((report) => (
                      <Link
                        key={report.id}
                        to="/reports"
                        className="block p-3 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors"
                      >
                        <p className="font-medium text-sm">{report.spare_parts?.name || 'Pièce'}</p>
                        <p className="text-xs text-muted-foreground">
                          {report.reporter_profile
                            ? `${report.reporter_profile.first_name || ''} ${report.reporter_profile.last_name || ''}`.trim()
                            : 'Utilisateur'}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
                <Button variant="ghost" asChild className="w-full mt-3 gap-1">
                  <Link to="/reports">
                    Voir tous les signalements
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Conformity stats for manager */}
            {totalWithConformity > 0 && (
              <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <PercentCircle className="h-5 w-5 text-primary" />
                    Conformité
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      Conformes
                    </span>
                    <span className="font-semibold text-success">{conformRequests.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ShieldX className="h-4 w-4 text-warning" />
                      Non conformes
                    </span>
                    <span className="font-semibold text-warning">{nonConformRequests.length}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Taux de conformité</span>
                      <span className="font-medium">{100 - nonConformRate}%</span>
                    </div>
                    <Progress value={100 - nonConformRate} className="h-2 mt-1" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Low stock */}
            {lowStockParts.length > 0 && (
              <Card className="border-destructive/30 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Stock critique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lowStockParts.slice(0, 5).map((part) => (
                      <Link
                        key={part.id}
                        to={`/stock/${part.id}`}
                        className="block p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                      >
                        <p className="font-medium text-sm">{part.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock: <span className="font-semibold text-destructive">{part.current_quantity}</span> / Min: {part.minimum_quantity}
                        </p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD (full view)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de la gestion des pièces de rechange
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Pièces en stock"
          value={parts.length}
          icon={Package}
        />
        <StatCard
          title="Demandes en attente"
          value={pendingRequests.length}
          icon={Clock}
          variant={pendingRequests.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Stock critique"
          value={lowStockParts.length}
          icon={AlertTriangle}
          variant={lowStockParts.length > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Demandes validées"
          value={approvedRequests.length}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Taux non-conformité"
          value={`${nonConformRate}%`}
          icon={ShieldX}
          variant={nonConformRate > 20 ? 'danger' : nonConformRate > 10 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent requests */}
        <Card className="lg:col-span-2 animate-slide-up">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Demandes récentes</CardTitle>
              <CardDescription>Les dernières demandes de pièces</CardDescription>
            </div>
            <Button variant="ghost" asChild className="gap-1">
              <Link to="/requests">
                Voir tout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune demande pour le moment
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((request, index) => {
                  const requesterName = request.requester_profile
                    ? `${request.requester_profile.first_name || ''} ${request.requester_profile.last_name || ''}`.trim() || 'Utilisateur'
                    : 'Utilisateur';

                  return (
                    <Link
                      key={request.id}
                      to={`/requests/${request.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-primary">
                            {request.request_number}
                          </span>
                          <StatusBadge status={request.status} />
                          <UrgencyBadge urgency={request.urgency} />
                        </div>
                        <p className="mt-1 text-sm font-medium truncate">
                          {request.spare_parts?.name || 'Pièce inconnue'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Par {requesterName} • {format(new Date(request.created_at), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts panel */}
        <div className="space-y-6">
          {/* Low stock alert */}
          <Card className="border-warning/30 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                Stock critique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockParts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune alerte de stock</p>
              ) : (
                <div className="space-y-3">
                  {lowStockParts.slice(0, 5).map((part) => (
                    <Link
                      key={part.id}
                      to={`/stock/${part.id}`}
                      className="block p-3 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors"
                    >
                      <p className="font-medium text-sm">{part.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: <span className="font-semibold text-warning">{part.current_quantity}</span> / Min: {part.minimum_quantity} {part.unit}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Non-conform parts */}
          {nonConformParts.length > 0 && (
            <Card className="border-destructive/30 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Pièces non conformes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nonConformParts.slice(0, 5).map((part) => (
                    <Link
                      key={part.id}
                      to={`/stock/${part.id}`}
                      className="block p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    >
                      <p className="font-medium text-sm">{part.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{part.code}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports summary */}
          <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-primary" />
                Signalements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">En attente</span>
                <span className="font-semibold">{pendingReports.length}</span>
              </div>
              <Button variant="ghost" asChild className="w-full mt-3 gap-1">
                <Link to="/reports">
                  Voir les signalements
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Conformity stats */}
          {totalWithConformity > 0 && (
            <Card className="animate-slide-up" style={{ animationDelay: '400ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <PercentCircle className="h-5 w-5 text-primary" />
                  Conformité des demandes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      Conformes
                    </span>
                    <span className="font-semibold text-success">{conformRequests.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ShieldX className="h-4 w-4 text-warning" />
                      Non conformes
                    </span>
                    <span className="font-semibold text-warning">{nonConformRequests.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taux de conformité</span>
                    <span>{100 - nonConformRate}%</span>
                  </div>
                  <Progress value={100 - nonConformRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { StatusBadge } from '@/components/StatusBadge';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { ExcelExport } from '@/components/ExcelExport';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type PartRequest = Database['public']['Tables']['part_requests']['Row'];

interface RequestWithDetails extends PartRequest {
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

export default function RequestList() {
  const { user, isManager, isAdmin, isOperator } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  
  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conformity, setConformity] = useState<'conform' | 'non_conform' | ''>('');
  const [rejectConformity, setRejectConformity] = useState<'conform' | 'non_conform' | ''>('');

  const fetchRequests = async () => {
    if (!user) return;
    setIsLoading(true);

    let query = supabase
      .from('part_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Operators only see their own requests (unless also manager/admin)
    if (isOperator && !isManager && !isAdmin) {
      query = query.eq('requester_id', user.id);
    }
    
    // Managers only see pending requests (not drafts or decided ones)
    if (isManager && !isAdmin) {
      query = query.eq('status', 'pending');
    }

    const { data: requestsData } = await query;

    // Fetch profiles
    const requesterIds = [...new Set(requestsData?.map(r => r.requester_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', requesterIds);

    // Fetch parts
    const partIds = [...new Set(requestsData?.map(r => r.part_id) || [])];
    const { data: partsData } = await supabase
      .from('spare_parts')
      .select('id, code, name, unit')
      .in('id', partIds);

    const requestsWithDetails: RequestWithDetails[] = (requestsData || []).map(request => ({
      ...request,
      spare_parts: partsData?.find(p => p.id === request.part_id) || null,
      requester_profile: profilesData?.find(p => p.id === request.requester_id) || null,
    }));

    setRequests(requestsWithDetails);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [user, isOperator, isManager, isAdmin]);

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.spare_parts?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.spare_parts?.code || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || request.urgency === urgencyFilter;
    
    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const canApprove = (request: RequestWithDetails) => {
    // Managers can approve pending requests they didn't create
    // Admins can approve any pending request
    return (isManager || isAdmin) && request.status === 'pending' && (isAdmin || request.requester_id !== user?.id);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user) return;
    
    if (!conformity) {
      toast({
        title: 'Conformité requise',
        description: 'Veuillez indiquer si la demande est conforme ou non conforme.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);

    const { error } = await supabase
      .from('part_requests')
      .update({
        status: 'approved',
        validator_id: user.id,
        validated_at: new Date().toISOString(),
        conformity: conformity,
        validation_comment: approvalComment.trim() || null,
      })
      .eq('id', selectedRequest.id);

    setIsProcessing(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'approuver la demande.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Demande approuvée',
      description: `La demande ${selectedRequest.request_number} a été validée.`,
    });
    setShowApproveDialog(false);
    setSelectedRequest(null);
    setConformity('');
    setApprovalComment('');
    fetchRequests();
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) return;
    
    if (!rejectConformity) {
      toast({
        title: 'Conformité requise',
        description: 'Veuillez indiquer la conformité de la demande.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!rejectionReason.trim()) {
      toast({
        title: 'Justification requise',
        description: 'Veuillez fournir un motif de rejet.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    const { error } = await supabase
      .from('part_requests')
      .update({
        status: 'rejected',
        validator_id: user.id,
        validated_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
        conformity: rejectConformity,
      })
      .eq('id', selectedRequest.id);

    setIsProcessing(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de rejeter la demande.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Demande rejetée',
      description: `La demande ${selectedRequest.request_number} a été rejetée.`,
    });
    setShowRejectDialog(false);
    setSelectedRequest(null);
    setRejectionReason('');
    setRejectConformity('');
    fetchRequests();
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
          <h1 className="text-3xl font-bold tracking-tight">
            {isOperator && !isManager && !isAdmin ? 'Mes demandes' : 'Demandes'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isOperator && !isManager && !isAdmin 
              ? 'Suivi de vos demandes de pièces de rechange'
              : 'Suivi des demandes de pièces de rechange'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Only operators can create requests */}
          {isOperator && (
            <Button asChild variant="accent" className="gap-2">
              <Link to="/requests/new">
                <Plus className="h-4 w-4" />
                Nouvelle demande
              </Link>
            </Button>
          )}
          {isAdmin && <ExcelExport type="requests" />}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro ou pièce..."
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
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Validée</SelectItem>
                <SelectItem value="rejected">Rejetée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Urgence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les urgences</SelectItem>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Liste des demandes
          </CardTitle>
          <CardDescription>
            {filteredRequests.length} demande(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">N° Demande</TableHead>
                <TableHead>Pièce demandée</TableHead>
                <TableHead className="text-center">Qté</TableHead>
                <TableHead>Équipement</TableHead>
                {(isManager || isAdmin) && <TableHead>Demandeur</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Urgence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request, index) => {
                const requesterName = request.requester_profile
                  ? `${request.requester_profile.first_name || ''} ${request.requester_profile.last_name || ''}`.trim() || 'Utilisateur'
                  : 'Utilisateur';

                return (
                  <TableRow 
                    key={request.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="font-mono font-medium text-primary">
                      {request.request_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.spare_parts?.name || 'Pièce'}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {request.spare_parts?.code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {request.quantity_requested}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.equipment_name || '-'}
                    </TableCell>
                    {(isManager || isAdmin) && (
                      <TableCell className="text-sm">
                        {requesterName}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <UrgencyBadge urgency={request.urgency} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/requests/${request.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canApprove(request) && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-success hover:text-success"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowApproveDialog(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approuver la demande</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'approuver la demande {selectedRequest?.request_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <p className="font-medium">{selectedRequest?.spare_parts?.name}</p>
              <p className="text-sm text-muted-foreground">
                Quantité: {selectedRequest?.quantity_requested} • Équipement: {selectedRequest?.equipment_name || '-'}
              </p>
            </div>
            
            {/* Conformity selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Conformité de la demande *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConformity('conform')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    conformity === 'conform' 
                      ? 'border-success bg-success/10 text-success' 
                      : 'border-border hover:border-success/50'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Conforme</p>
                    <p className="text-xs text-muted-foreground">La demande respecte les critères</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setConformity('non_conform')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    conformity === 'non_conform' 
                      ? 'border-warning bg-warning/10 text-warning' 
                      : 'border-border hover:border-warning/50'
                  }`}
                >
                  <ShieldX className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Non conforme</p>
                    <p className="text-xs text-muted-foreground">Demande avec écart identifié</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Approval comment */}
            <div className="space-y-2">
              <Label htmlFor="approval-comment">Commentaire (optionnel)</Label>
              <Textarea
                id="approval-comment"
                placeholder="Ajoutez un commentaire à l'approbation..."
                rows={3}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowApproveDialog(false); setConformity(''); setApprovalComment(''); }}>
              Annuler
            </Button>
            <Button variant="success" onClick={handleApprove} disabled={isProcessing || !conformity} className="gap-2">
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
            <DialogDescription>
              Veuillez fournir une justification pour le rejet de la demande {selectedRequest?.request_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <p className="font-medium">{selectedRequest?.spare_parts?.name}</p>
              <p className="text-sm text-muted-foreground">
                Quantité: {selectedRequest?.quantity_requested} • Équipement: {selectedRequest?.equipment_name || '-'}
              </p>
            </div>
            
            {/* Conformity selection for rejection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Conformité de la demande *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRejectConformity('conform')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    rejectConformity === 'conform' 
                      ? 'border-success bg-success/10 text-success' 
                      : 'border-border hover:border-success/50'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Conforme</p>
                    <p className="text-xs text-muted-foreground">La demande respecte les critères</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRejectConformity('non_conform')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    rejectConformity === 'non_conform' 
                      ? 'border-warning bg-warning/10 text-warning' 
                      : 'border-border hover:border-warning/50'
                  }`}
                >
                  <ShieldX className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Non conforme</p>
                    <p className="text-xs text-muted-foreground">Demande avec écart identifié</p>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motif du rejet *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Expliquez pourquoi cette demande est rejetée..."
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectConformity(''); setRejectionReason(''); }}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectConformity} className="gap-2">
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              <XCircle className="h-4 w-4" />
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

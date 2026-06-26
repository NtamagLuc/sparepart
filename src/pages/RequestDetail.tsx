import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Package,
  FileText,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type PartRequest = Database['public']['Tables']['part_requests']['Row'];
type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

const reasonLabels: Record<string, string> = {
  missing: 'Pièce manquante',
  insufficient: 'Stock insuffisant',
  non_conform: 'Pièce non conforme',
  preventive: 'Maintenance préventive',
  corrective: 'Maintenance corrective',
};

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isManager, isAdmin } = useAuth();
  
  const [request, setRequest] = useState<PartRequest | null>(null);
  const [part, setPart] = useState<SparePart | null>(null);
  const [requesterProfile, setRequesterProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  const [validatorProfile, setValidatorProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conformity, setConformity] = useState<'conform' | 'non_conform' | ''>('');
  const [rejectConformity, setRejectConformity] = useState<'conform' | 'non_conform' | ''>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      // Fetch request
      const { data: requestData } = await supabase
        .from('part_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (!requestData) {
        setIsLoading(false);
        return;
      }

      setRequest(requestData);

      // Fetch part
      const { data: partData } = await supabase
        .from('spare_parts')
        .select('*')
        .eq('id', requestData.part_id)
        .single();
      setPart(partData);

      // Fetch requester profile
      const { data: requesterData } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', requestData.requester_id)
        .single();
      setRequesterProfile(requesterData);

      // Fetch validator profile if exists
      if (requestData.validator_id) {
        const { data: validatorData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', requestData.validator_id)
          .single();
        setValidatorProfile(validatorData);
      }

      // Fetch audit logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', id)
        .eq('entity_type', 'request')
        .order('created_at', { ascending: false });
      setAuditLogs(logsData || []);

      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  // Managers can approve pending requests they didn't create, admins can approve any pending request
  const canApprove = (isManager || isAdmin) && request?.status === 'pending' && (isAdmin || request.requester_id !== user?.id);

  const handleApprove = async () => {
    if (!request || !user) return;
    
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
      .eq('id', request.id);

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
      description: `La demande ${request.request_number} a été validée.`,
    });
    setShowApproveDialog(false);
    setConformity('');
    setApprovalComment('');
    navigate('/requests');
  };

  const handleReject = async () => {
    if (!request || !user) return;
    
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
      .eq('id', request.id);

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
      description: `La demande ${request.request_number} a été rejetée.`,
    });
    setShowRejectDialog(false);
    setRejectConformity('');
    setRejectionReason('');
    navigate('/requests');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Demande non trouvée</h2>
        <p className="text-muted-foreground mt-1">Cette demande n'existe pas ou a été supprimée.</p>
        <Button onClick={() => navigate('/requests')} className="mt-4">
          Retour aux demandes
        </Button>
      </div>
    );
  }

  const requesterName = requesterProfile
    ? `${requesterProfile.first_name || ''} ${requesterProfile.last_name || ''}`.trim() || 'Utilisateur'
    : 'Utilisateur';

  const validatorName = validatorProfile
    ? `${validatorProfile.first_name || ''} ${validatorProfile.last_name || ''}`.trim() || 'Responsable'
    : 'Responsable';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight font-mono">
                {request.request_number}
              </h1>
              <StatusBadge status={request.status} />
              <UrgencyBadge urgency={request.urgency} />
            </div>
            <p className="text-muted-foreground mt-1">
              Créée le {format(new Date(request.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>
        
        {canApprove && (
          <div className="flex items-center gap-3">
            <Button 
              variant="destructive" 
              className="gap-2"
              onClick={() => setShowRejectDialog(true)}
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </Button>
            <Button 
              variant="success" 
              className="gap-2"
              onClick={() => setShowApproveDialog(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approuver
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Détails de la demande
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Pièce demandée</p>
                  <p className="font-medium">{part?.name || 'Pièce'}</p>
                  <p className="text-xs font-mono text-primary">{part?.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantité</p>
                  <p className="text-2xl font-bold">{request.quantity_requested}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Motif</p>
                  <Badge variant="secondary">{reasonLabels[request.reason] || request.reason}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Équipement</p>
                  <p className="font-medium">{request.equipment_name || '-'}</p>
                </div>
              </div>
              
              {request.equipment_location && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Localisation</p>
                    <p className="font-medium">{request.equipment_location}</p>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-sm leading-relaxed bg-secondary/50 p-4 rounded-lg">
                  {request.description || 'Aucune description fournie.'}
                </p>
              </div>

              {request.justification && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Justification</p>
                  <p className="text-sm leading-relaxed bg-secondary/50 p-4 rounded-lg">
                    {request.justification}
                  </p>
                </div>
              )}

              {request.status === 'rejected' && request.rejection_reason && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive mb-1">Motif du rejet</p>
                    <p className="text-sm">{request.rejection_reason}</p>
                  </div>
                </>
              )}

              {request.status === 'approved' && request.erp_reference && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm font-medium text-success mb-1">Référence ERP</p>
                    <p className="font-mono">{request.erp_reference}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log, index) => (
                    <div 
                      key={log.id} 
                      className="flex gap-4 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {index < auditLogs.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-sm">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          Par {log.user_name || 'Système'} • {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex gap-4">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-sm">Demande créée</p>
                      <p className="text-xs text-muted-foreground">
                        Par {requesterName} • {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Requester */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Demandeur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{requesterName}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(request.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </p>
            </CardContent>
          </Card>

          {/* Validator */}
          {request.validator_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Validateur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{validatorName}</p>
                {request.validated_at && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(request.validated_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Part info */}
          {part && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Pièce en stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Stock actuel</p>
                  <p className={`font-semibold ${part.current_quantity <= part.minimum_quantity ? 'text-warning' : ''}`}>
                    {part.current_quantity} {part.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Seuil minimum</p>
                  <p className="text-sm">{part.minimum_quantity} {part.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emplacement</p>
                  <p className="text-sm">{part.location || '-'}</p>
                </div>
                {part.is_non_conform && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Non conforme</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approuver la demande</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'approuver la demande {request.request_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <p className="font-medium">{part?.name}</p>
              <p className="text-sm text-muted-foreground">
                Quantité: {request.quantity_requested} • Équipement: {request.equipment_name || '-'}
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
              <Label htmlFor="approval-comment-detail">Commentaire (optionnel)</Label>
              <Textarea
                id="approval-comment-detail"
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
              Confirmer l'approbation
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
              Veuillez fournir une justification pour le rejet de la demande {request.request_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <p className="font-medium">{part?.name}</p>
              <p className="text-sm text-muted-foreground">
                Quantité: {request.quantity_requested} • Équipement: {request.equipment_name || '-'}
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
              <Label htmlFor="rejection-reason-detail">Motif du rejet *</Label>
              <Textarea
                id="rejection-reason-detail"
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

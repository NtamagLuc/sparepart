import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type ReportIssueType = Database['public']['Enums']['report_issue_type'];

const issueTypeOptions: { value: ReportIssueType; label: string; description: string }[] = [
  { value: 'damaged', label: 'Endommagée', description: 'La pièce présente des dommages physiques' },
  { value: 'defective', label: 'Défectueuse', description: 'La pièce ne fonctionne pas correctement' },
  { value: 'wrong_reference', label: 'Mauvaise référence', description: 'La pièce ne correspond pas à la référence' },
  { value: 'other', label: 'Autre', description: 'Autre type de problème' },
];

export default function NewPartReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, isManager, isAdmin } = useAuth();
  
  const [parts, setParts] = useState<SparePart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    partId: searchParams.get('partId') || '',
    issueType: '' as ReportIssueType | '',
    description: '',
  });

  useEffect(() => {
    const fetchParts = async () => {
      const { data } = await supabase
        .from('spare_parts')
        .select('*')
        .order('code', { ascending: true });
      setParts(data || []);
      setIsLoading(false);
    };
    fetchParts();
  }, []);

  const selectedPart = parts.find(p => p.id === formData.partId);

  // Only operators can create reports
  if (isManager || isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Accès non autorisé</h2>
        <p className="text-muted-foreground mt-1">
          Seuls les exploitants peuvent signaler des pièces.
        </p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!formData.partId || !formData.issueType || !formData.description) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const reportData = {
      part_id: formData.partId,
      reporter_id: user?.id!,
      issue_type: formData.issueType as ReportIssueType,
      description: formData.description,
    };

    const { error } = await supabase
      .from('part_reports')
      .insert([reportData]);

    setIsSubmitting(false);

    if (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le signalement. Veuillez réessayer.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Signalement envoyé",
      description: "Votre signalement a été transmis au responsable maintenance.",
    });
    
    navigate('/reports');
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signaler une pièce</h1>
          <p className="text-muted-foreground mt-1">
            Signalez un problème sur une pièce de rechange
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations du signalement</CardTitle>
            <CardDescription>
              Décrivez le problème rencontré avec la pièce
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Part selection */}
            <div className="space-y-2">
              <Label htmlFor="part">Pièce concernée *</Label>
              <Select 
                value={formData.partId} 
                onValueChange={(value) => setFormData({ ...formData, partId: value })}
              >
                <SelectTrigger id="part">
                  <SelectValue placeholder="Sélectionner une pièce" />
                </SelectTrigger>
                <SelectContent>
                  {parts.map(part => (
                    <SelectItem key={part.id} value={part.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary">{part.code}</span>
                        <span>{part.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Type */}
            <div className="space-y-2">
              <Label htmlFor="issueType">Type de problème *</Label>
              <Select 
                value={formData.issueType} 
                onValueChange={(value) => setFormData({ ...formData, issueType: value as ReportIssueType })}
              >
                <SelectTrigger id="issueType">
                  <SelectValue placeholder="Sélectionner le type de problème" />
                </SelectTrigger>
                <SelectContent>
                  {issueTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          - {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description du problème *</Label>
              <Textarea
                id="description"
                placeholder="Décrivez en détail le problème observé sur la pièce..."
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Selected part info */}
          {selectedPart && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">Pièce sélectionnée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="font-mono font-medium text-primary">{selectedPart.code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Désignation</p>
                  <p className="font-medium">{selectedPart.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Catégorie</p>
                  <p className="text-sm">{selectedPart.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emplacement</p>
                  <p className="text-sm">{selectedPart.location || '-'}</p>
                </div>
                {selectedPart.is_non_conform && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Déjà signalée non conforme</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleSubmit} 
              className="gap-2"
              variant="accent"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer le signalement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

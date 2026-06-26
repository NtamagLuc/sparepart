import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send,
  Save,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
type PowerPlant = Database['public']['Tables']['power_plants']['Row'];
type RequestReason = Database['public']['Enums']['request_reason'];
type UrgencyLevel = Database['public']['Enums']['urgency_level'];

const reasonOptions: { value: RequestReason; label: string }[] = [
  { value: 'missing', label: 'Pièce manquante' },
  { value: 'insufficient', label: 'Stock insuffisant' },
  { value: 'non_conform', label: 'Pièce non conforme' },
  { value: 'preventive', label: 'Maintenance préventive' },
  { value: 'corrective', label: 'Maintenance corrective' },
];

const urgencyOptions: { value: UrgencyLevel; label: string; description: string }[] = [
  { value: 'low', label: 'Basse', description: 'Peut attendre plusieurs semaines' },
  { value: 'medium', label: 'Moyenne', description: 'À traiter dans la semaine' },
  { value: 'high', label: 'Haute', description: 'Urgent, sous 48h' },
  { value: 'critical', label: 'Critique', description: 'Arrêt d\'exploitation imminent' },
];

export default function NewRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  const [parts, setParts] = useState<SparePart[]>([]);
  const [powerPlants, setPowerPlants] = useState<PowerPlant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    partId: searchParams.get('partId') || '',
    quantity: 1,
    reason: (searchParams.get('reason') as RequestReason) || '',
    urgency: '' as UrgencyLevel | '',
    equipmentName: '',
    powerPlantId: '',
    description: '',
    justification: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const [partsResult, plantsResult] = await Promise.all([
        supabase.from('spare_parts').select('*').order('code', { ascending: true }),
        supabase.from('power_plants').select('*').eq('is_active', true).order('name', { ascending: true })
      ]);
      setParts(partsResult.data || []);
      setPowerPlants(plantsResult.data || []);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const selectedPart = parts.find(p => p.id === formData.partId);
  const selectedPlant = powerPlants.find(p => p.id === formData.powerPlantId);

  // Only operators can create requests
  const { isOperator } = useAuth();
  
  if (!isOperator) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Accès non autorisé</h2>
        <p className="text-muted-foreground mt-1">
          Seuls les exploitants peuvent créer des demandes.
        </p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  const handleSubmit = async (asDraft: boolean) => {
    if (!formData.partId || !formData.reason || !formData.urgency || !formData.description) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Générer un numéro de demande temporaire (sera remplacé par le trigger)
    const tempRequestNumber = `DEM-${Date.now()}`;
    
    const requestData = {
      part_id: formData.partId,
      requester_id: user?.id!,
      quantity_requested: formData.quantity,
      reason: formData.reason as RequestReason,
      urgency: formData.urgency as UrgencyLevel,
      status: asDraft ? 'draft' as const : 'pending' as const,
      description: formData.description,
      equipment_name: formData.equipmentName || null,
      equipment_location: selectedPlant?.name || null,
      power_plant_id: formData.powerPlantId || null,
      justification: formData.justification || null,
      submitted_at: asDraft ? null : new Date().toISOString(),
      request_number: tempRequestNumber,
    };

    const { error } = await supabase
      .from('part_requests')
      .insert([requestData]);

    setIsSubmitting(false);

    if (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la demande. Veuillez réessayer.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: asDraft ? "Brouillon enregistré" : "Demande soumise",
      description: asDraft 
        ? "Votre demande a été sauvegardée en brouillon."
        : "Votre demande a été envoyée pour validation.",
    });
    
    navigate('/requests');
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
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle demande</h1>
          <p className="text-muted-foreground mt-1">
            Créer une demande de pièce de rechange
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations de la demande</CardTitle>
            <CardDescription>
              Remplissez les informations concernant la pièce demandée
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Part selection */}
            <div className="space-y-2">
              <Label htmlFor="part">Pièce demandée *</Label>
              <Select 
                value={formData.partId} 
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    partId: value,
                  });
                }}
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
                        {part.current_quantity <= part.minimum_quantity && (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity and Equipment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantité demandée *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
                {selectedPart && (
                  <p className="text-xs text-muted-foreground">
                    Stock actuel: {selectedPart.current_quantity} {selectedPart.unit}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment">Équipement concerné</Label>
                <Input
                  id="equipment"
                  placeholder="Ex: Turbine T1"
                  value={formData.equipmentName}
                  onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                />
              </div>
            </div>

            {/* Power Plant Selection */}
            <div className="space-y-2">
              <Label htmlFor="powerPlant">Centrale</Label>
              <Select 
                value={formData.powerPlantId} 
                onValueChange={(value) => setFormData({ ...formData, powerPlantId: value })}
              >
                <SelectTrigger id="powerPlant">
                  <SelectValue placeholder="Sélectionner une centrale" />
                </SelectTrigger>
                <SelectContent>
                  {powerPlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary">{plant.code}</span>
                        <span>{plant.name}</span>
                        {plant.location && (
                          <span className="text-xs text-muted-foreground">- {plant.location}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motif de la demande *</Label>
              <Select 
                value={formData.reason} 
                onValueChange={(value) => setFormData({ ...formData, reason: value as RequestReason })}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Sélectionner un motif" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <Label htmlFor="urgency">Niveau d'urgence *</Label>
              <Select 
                value={formData.urgency} 
                onValueChange={(value) => setFormData({ ...formData, urgency: value as UrgencyLevel })}
              >
                <SelectTrigger id="urgency">
                  <SelectValue placeholder="Sélectionner l'urgence" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map(option => (
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
              <Label htmlFor="description">Description détaillée *</Label>
              <Textarea
                id="description"
                placeholder="Décrivez le contexte de la demande, les travaux prévus, les contraintes..."
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <Label htmlFor="justification">Justification complémentaire</Label>
              <Textarea
                id="justification"
                placeholder="Ajoutez des éléments de justification pour appuyer votre demande..."
                rows={3}
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
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
                  <p className="text-xs text-muted-foreground">Stock actuel</p>
                  <p className={`font-semibold ${selectedPart.current_quantity <= selectedPart.minimum_quantity ? 'text-warning' : ''}`}>
                    {selectedPart.current_quantity} {selectedPart.unit}
                    {selectedPart.current_quantity <= selectedPart.minimum_quantity && (
                      <span className="text-xs font-normal ml-2">(Stock bas)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emplacement</p>
                  <p className="text-sm">{selectedPart.location || '-'}</p>
                </div>
                {selectedPart.is_non_conform && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Pièce non conforme signalée</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Requester info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Demandeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Nom</p>
                <p className="font-medium">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email
                  }
                </p>
              </div>
              {profile?.department && (
                <div>
                  <p className="text-xs text-muted-foreground">Service</p>
                  <p className="text-sm">{profile.department}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => handleSubmit(false)} 
              className="gap-2"
              variant="accent"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Soumettre la demande
            </Button>
            <Button 
              onClick={() => handleSubmit(true)} 
              variant="outline"
              className="gap-2"
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4" />
              Enregistrer en brouillon
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

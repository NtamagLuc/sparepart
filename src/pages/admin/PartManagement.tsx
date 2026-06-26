import { useState, useEffect } from 'react';
import { 
  Package, 
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ImageUpload } from '@/components/ImageUpload';
import { formatCurrency } from '@/lib/formatCurrency';
import { Database } from '@/integrations/supabase/types';

type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type PartImage = Database['public']['Tables']['part_images']['Row'];

interface PartFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  location: string;
  current_quantity: number;
  minimum_quantity: number;
  unit: string;
  unit_price: number | null;
  supplier: string;
  manufacturer: string;
  manufacturer_ref: string;
  is_critical: boolean;
  is_non_conform: boolean;
  non_conform_reason: string;
  sap_article_number: string;
}

const emptyFormData: PartFormData = {
  code: '',
  name: '',
  description: '',
  category: '',
  location: '',
  current_quantity: 0,
  minimum_quantity: 0,
  unit: 'pièce',
  unit_price: null,
  supplier: '',
  manufacturer: '',
  manufacturer_ref: '',
  is_critical: false,
  is_non_conform: false,
  non_conform_reason: '',
  sap_article_number: '',
};

export default function PartManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parts, setParts] = useState<SparePart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [formData, setFormData] = useState<PartFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [partImages, setPartImages] = useState<PartImage[]>([]);

  const fetchParts = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      console.error('Error fetching parts:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les pièces.',
        variant: 'destructive',
      });
    } else {
      setParts(data || []);
    }
    
    setIsLoading(false);
  };

  const fetchPartImages = async (partId: string) => {
    const { data } = await supabase
      .from('part_images')
      .select('*')
      .eq('part_id', partId)
      .order('display_order', { ascending: true });
    setPartImages(data || []);
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const filteredParts = parts.filter(part => {
    const matchesSearch = 
      part.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const handleOpenCreate = () => {
    setSelectedPart(null);
    setFormData(emptyFormData);
    setPartImages([]);
    setShowPartDialog(true);
  };

  const handleOpenEdit = async (part: SparePart) => {
    setSelectedPart(part);
    setFormData({
      code: part.code,
      name: part.name,
      description: part.description || '',
      category: part.category,
      location: part.location || '',
      current_quantity: part.current_quantity,
      minimum_quantity: part.minimum_quantity,
      unit: part.unit,
      unit_price: part.unit_price ? Number(part.unit_price) : null,
      supplier: part.supplier || '',
      manufacturer: part.manufacturer || '',
      manufacturer_ref: part.manufacturer_ref || '',
      is_critical: part.is_critical,
      is_non_conform: part.is_non_conform,
      non_conform_reason: part.non_conform_reason || '',
      sap_article_number: part.sap_article_number || '',
    });
    await fetchPartImages(part.id);
    setShowPartDialog(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.category) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const partData = {
      ...formData,
      updated_by: user?.id,
    };

    if (selectedPart) {
      // Update
      const { error } = await supabase
        .from('spare_parts')
        .update(partData)
        .eq('id', selectedPart.id);

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de modifier la pièce.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pièce modifiée',
          description: `La pièce ${formData.code} a été mise à jour.`,
        });
        setShowPartDialog(false);
        fetchParts();
      }
    } else {
      // Create
      const { error } = await supabase
        .from('spare_parts')
        .insert({
          ...partData,
          created_by: user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Code déjà utilisé',
            description: 'Ce code article existe déjà.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erreur',
            description: 'Impossible de créer la pièce.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Pièce créée',
          description: `La pièce ${formData.code} a été ajoutée au catalogue.`,
        });
        setShowPartDialog(false);
        fetchParts();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedPart) return;

    const { error } = await supabase
      .from('spare_parts')
      .delete()
      .eq('id', selectedPart.id);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la pièce.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pièce supprimée',
        description: `La pièce ${selectedPart.code} a été supprimée.`,
      });
      setShowDeleteDialog(false);
      fetchParts();
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Gestion du catalogue</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les pièces de rechange du système
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle pièce
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code, nom ou catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Parts table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catalogue des pièces
          </CardTitle>
          <CardDescription>
            {filteredParts.length} pièce(s) dans le catalogue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Code</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.map((part, index) => {
                const isLowStock = part.current_quantity <= part.minimum_quantity;
                
                return (
                  <TableRow 
                    key={part.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="font-mono font-medium text-primary">
                      {part.code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{part.name}</p>
                        {part.manufacturer && (
                          <p className="text-xs text-muted-foreground">{part.manufacturer}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{part.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={isLowStock ? 'text-warning font-semibold' : ''}>
                        {part.current_quantity}
                      </span>
                      <span className="text-muted-foreground text-xs ml-1">
                        / {part.minimum_quantity} min
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {part.unit_price ? formatCurrency(Number(part.unit_price)) : '-'}
                    </TableCell>
                    <TableCell>
                      {part.is_non_conform ? (
                        <Badge variant="destructive">Non conforme</Badge>
                      ) : part.is_critical ? (
                        <Badge variant="warning">Critique</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEdit(part)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedPart(part);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Part Dialog */}
      <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPart ? 'Modifier la pièce' : 'Nouvelle pièce'}
            </DialogTitle>
            <DialogDescription>
              {selectedPart 
                ? `Modification de ${selectedPart.code}`
                : 'Ajoutez une nouvelle pièce au catalogue'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code article *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="TRB-BRG-001"
                  disabled={!!selectedPart}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Roulements"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Désignation *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Roulement à billes turbine"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description détaillée de la pièce..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_quantity">Stock actuel</Label>
                <Input
                  id="current_quantity"
                  type="number"
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({ ...formData, current_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum_quantity">Stock minimum</Label>
                <Input
                  id="minimum_quantity"
                  type="number"
                  value={formData.minimum_quantity}
                  onChange={(e) => setFormData({ ...formData, minimum_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unité</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="pièce"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Emplacement</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Magasin A - Étagère R3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Prix unitaire (FCFA)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="1"
                  value={formData.unit_price || ''}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || null })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricant</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Fournisseur</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sap_article_number">Numéro article SAP</Label>
              <Input
                id="sap_article_number"
                value={formData.sap_article_number}
                onChange={(e) => setFormData({ ...formData, sap_article_number: e.target.value })}
                placeholder="MAT-123456"
              />
            </div>
            
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_critical"
                  checked={formData.is_critical}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_critical: checked })}
                />
                <Label htmlFor="is_critical">Pièce critique</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_non_conform"
                  checked={formData.is_non_conform}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_non_conform: checked })}
                />
                <Label htmlFor="is_non_conform">Non conforme</Label>
              </div>
            </div>
            
            {formData.is_non_conform && (
              <div className="space-y-2">
                <Label htmlFor="non_conform_reason">Motif de non-conformité</Label>
                <Textarea
                  id="non_conform_reason"
                  value={formData.non_conform_reason}
                  onChange={(e) => setFormData({ ...formData, non_conform_reason: e.target.value })}
                  placeholder="Décrivez le problème de conformité..."
                  rows={2}
                />
              </div>
            )}

            {/* Image upload - only show when editing an existing part */}
            {selectedPart && (
              <>
                <Separator className="my-2" />
                <ImageUpload
                  partId={selectedPart.id}
                  images={partImages}
                  onImagesChange={() => fetchPartImages(selectedPart.id)}
                />
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {selectedPart ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette pièce ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la pièce {selectedPart?.code} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

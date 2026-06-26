import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
  FileText,
  Flag,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ImageGallery } from '@/components/ImageGallery';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatCurrency';
import { Database } from '@/integrations/supabase/types';

type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type PartRequest = Database['public']['Tables']['part_requests']['Row'];
type PartImage = Database['public']['Tables']['part_images']['Row'];

interface RequestWithProfile extends PartRequest {
  requester_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export default function PartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isOperator, isManager } = useAuth();

  const [part, setPart] = useState<SparePart | null>(null);
  const [images, setImages] = useState<PartImage[]>([]);
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      // Fetch part
      const { data: partData } = await supabase
        .from('spare_parts')
        .select('*')
        .eq('id', id)
        .single();

      if (!partData) {
        setIsLoading(false);
        return;
      }

      setPart(partData);

      // Fetch images
      const { data: imagesData } = await supabase
        .from('part_images')
        .select('*')
        .eq('part_id', id)
        .order('display_order', { ascending: true });
      setImages(imagesData || []);

      // Fetch related requests
      const { data: requestsData } = await supabase
        .from('part_requests')
        .select('*')
        .eq('part_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch requester profiles
      const requesterIds = [...new Set(requestsData?.map(r => r.requester_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', requesterIds);

      const requestsWithProfiles: RequestWithProfile[] = (requestsData || []).map(request => ({
        ...request,
        requester_profile: profilesData?.find(p => p.id === request.requester_id) || null,
      }));

      setRequests(requestsWithProfiles);
      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!part) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Pièce non trouvée</h2>
        <p className="text-muted-foreground mt-1">Cette pièce n'existe pas ou a été supprimée.</p>
        <Button onClick={() => navigate('/stock')} className="mt-4">
          Retour au stock
        </Button>
      </div>
    );
  }

  const isLowStock = part.current_quantity <= part.minimum_quantity;
  const canCreateRequest = isOperator && !isManager && !isAdmin;

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
              <h1 className="text-3xl font-bold tracking-tight font-mono text-primary">
                {part.code}
              </h1>
              {part.is_non_conform && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Non conforme
                </Badge>
              )}
              {isLowStock && !part.is_non_conform && (
                <Badge variant="warning">Stock bas</Badge>
              )}
            </div>
            <p className="text-xl font-medium mt-1">{part.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {canCreateRequest && (
            <>
              <Button asChild variant="outline" className="gap-2">
                <Link to={`/reports/new?partId=${part.id}`}>
                  <Flag className="h-4 w-4" />
                  Signaler
                </Link>
              </Button>
              <Button asChild variant="accent" className="gap-2">
                <Link to={`/requests/new?partId=${part.id}`}>
                  <FileText className="h-4 w-4" />
                  Créer une demande
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          {images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGallery images={images} />
              </CardContent>
            </Card>
          )}

          {/* Part details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Informations de la pièce
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {part.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm leading-relaxed">{part.description}</p>
                </div>
              )}
              
              <Separator />
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Catégorie</p>
                  <Badge variant="secondary" className="mt-1">{part.category}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unité</p>
                  <p className="font-medium">{part.unit}</p>
                </div>
                {part.manufacturer && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fabricant</p>
                    <p className="font-medium">{part.manufacturer}</p>
                  </div>
                )}
                {part.supplier && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fournisseur</p>
                    <p className="font-medium">{part.supplier}</p>
                  </div>
                )}
                {part.sap_article_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">N° Article SAP</p>
                    <p className="font-mono text-sm">{part.sap_article_number}</p>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Emplacement</p>
                    <p className="font-medium">{part.location || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
                    <p className="font-medium">
                      {format(new Date(part.updated_at), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price - Admin only */}
              {isAdmin && part.unit_price && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Prix unitaire</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(Number(part.unit_price))}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Related requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Demandes associées
              </CardTitle>
              <CardDescription>
                Historique des demandes pour cette pièce
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune demande pour cette pièce
                </p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request, index) => {
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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-primary">
                              {request.request_number}
                            </span>
                            <StatusBadge status={request.status} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {request.quantity_requested} {part.unit} • Par {requesterName}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock level */}
          <Card className={isLowStock ? 'border-warning/30' : ''}>
            <CardHeader>
              <CardTitle className="text-lg">Niveau de stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className={`text-5xl font-bold ${isLowStock ? 'text-warning' : ''}`}>
                  {part.current_quantity}
                </p>
                <p className="text-muted-foreground">{part.unit}</p>
              </div>
              
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seuil minimum</span>
                  <span className="font-medium">{part.minimum_quantity} {part.unit}</span>
                </div>
                
                {/* Stock bar */}
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${isLowStock ? 'bg-warning' : 'bg-success'}`}
                    style={{ 
                      width: `${Math.min((part.current_quantity / (part.minimum_quantity * 2)) * 100, 100)}%` 
                    }}
                  />
                </div>
                
                {isLowStock && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Stock en dessous du seuil</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Non-conform alert */}
          {part.is_non_conform && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pièce non conforme
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {part.non_conform_reason || 'Cette pièce a été signalée comme non conforme.'}
                </p>
                {canCreateRequest && (
                  <Button asChild variant="destructive" className="w-full mt-4 gap-2">
                    <Link to={`/requests/new?partId=${part.id}&reason=non_conform`}>
                      <FileText className="h-4 w-4" />
                      Signaler et demander
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Report button for operators */}
          {canCreateRequest && !part.is_non_conform && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Signalement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Vous avez constaté un problème avec cette pièce ?
                </p>
                <Button asChild variant="outline" className="w-full gap-2">
                  <Link to={`/reports/new?partId=${part.id}`}>
                    <Flag className="h-4 w-4" />
                    Signaler un problème
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

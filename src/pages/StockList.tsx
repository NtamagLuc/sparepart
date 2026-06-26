import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Search, 
  AlertTriangle,
  Eye,
  Plus,
  Loader2,
  ImageIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type SparePart = Database['public']['Tables']['spare_parts']['Row'];
type PartImage = Database['public']['Tables']['part_images']['Row'];

interface PartWithImage extends SparePart {
  primaryImage?: PartImage | null;
}

export default function StockList() {
  const { isAdmin, isOperator } = useAuth();
  const [parts, setParts] = useState<PartWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  useEffect(() => {
    const fetchParts = async () => {
      setIsLoading(true);
      
      // Fetch parts
      const { data: partsData, error: partsError } = await supabase
        .from('spare_parts')
        .select('*')
        .order('code', { ascending: true });

      if (partsError) {
        console.error('Error fetching parts:', partsError);
        setIsLoading(false);
        return;
      }

      // Fetch primary images for all parts
      const partIds = partsData?.map(p => p.id) || [];
      const { data: imagesData } = await supabase
        .from('part_images')
        .select('*')
        .in('part_id', partIds)
        .eq('is_primary', true);

      // Map images to parts
      const partsWithImages: PartWithImage[] = (partsData || []).map(part => ({
        ...part,
        primaryImage: imagesData?.find(img => img.part_id === part.id) || null,
      }));

      setParts(partsWithImages);
      setIsLoading(false);
    };

    fetchParts();
  }, []);

  const categories = [...new Set(parts.map(p => p.category))];

  const filteredParts = parts.filter(part => {
    const matchesSearch = 
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
    
    const matchesStock = 
      stockFilter === 'all' ||
      (stockFilter === 'low' && part.current_quantity <= part.minimum_quantity) ||
      (stockFilter === 'ok' && part.current_quantity > part.minimum_quantity) ||
      (stockFilter === 'nonconform' && part.is_non_conform);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('part-images').getPublicUrl(storagePath);
    return data.publicUrl;
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
          <h1 className="text-3xl font-bold tracking-tight">Stock des pièces</h1>
          <p className="text-muted-foreground mt-1">
            Catalogue complet des pièces de rechange disponibles
          </p>
        </div>
        {!isAdmin && (
          <Button asChild variant="accent" className="gap-2">
            <Link to="/requests/new">
              <Plus className="h-4 w-4" />
              Demander une pièce
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="État du stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="ok">Stock OK</SelectItem>
                <SelectItem value="low">Stock bas</SelectItem>
                <SelectItem value="nonconform">Non conforme</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pièces en stock
          </CardTitle>
          <CardDescription>
            {filteredParts.length} pièce(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredParts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune pièce trouvée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead className="w-[140px]">Code</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  {isAdmin && <TableHead className="text-right">Prix unit.</TableHead>}
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
                      <TableCell>
                        {part.primaryImage ? (
                          <img 
                            src={getImageUrl(part.primaryImage.storage_path)}
                            alt={part.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
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
                      <TableCell className="text-sm text-muted-foreground">
                        {part.location || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={cn(
                          "inline-flex items-center gap-1 font-semibold",
                          isLowStock ? "text-warning" : "text-foreground"
                        )}>
                          {isLowStock && <AlertTriangle className="h-4 w-4" />}
                          {part.current_quantity} {part.unit}
                        </div>
                        <p className="text-xs text-muted-foreground">Min: {part.minimum_quantity}</p>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right font-medium">
                          {part.unit_price 
                            ? `${Number(part.unit_price).toLocaleString('fr-FR')} FCFA`
                            : '-'
                          }
                        </TableCell>
                      )}
                      <TableCell>
                        {part.is_non_conform ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Non conforme
                          </Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning">Stock bas</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/stock/${part.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {isOperator && (
                            <Button variant="ghost" size="sm" asChild title="Signaler un problème">
                              <Link to={`/reports/new?partId=${part.id}`}>
                                <AlertTriangle className="h-4 w-4 text-warning" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
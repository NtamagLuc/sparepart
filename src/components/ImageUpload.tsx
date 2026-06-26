import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PartImage {
  id: string;
  storage_path: string;
  file_name: string;
  is_primary: boolean;
  display_order: number;
}

interface ImageUploadProps {
  partId: string;
  images: PartImage[];
  onImagesChange: () => void;
  className?: string;
}

export function ImageUpload({ partId, images, onImagesChange, className }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('part-images').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Fichier invalide',
          description: 'Veuillez sélectionner uniquement des images.',
          variant: 'destructive',
        });
        continue;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${partId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('part-images')
        .upload(fileName, file);

      if (uploadError) {
        toast({
          title: 'Erreur d\'upload',
          description: 'Impossible de télécharger l\'image.',
          variant: 'destructive',
        });
        continue;
      }

      // Insert record in database
      const { error: dbError } = await supabase
        .from('part_images')
        .insert({
          part_id: partId,
          storage_path: fileName,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          is_primary: images.length === 0, // First image is primary by default
          display_order: images.length,
        });

      if (dbError) {
        toast({
          title: 'Erreur',
          description: 'Impossible d\'enregistrer l\'image.',
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);
    onImagesChange();
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (image: PartImage) => {
    // Delete from storage
    await supabase.storage.from('part-images').remove([image.storage_path]);

    // Delete from database
    await supabase.from('part_images').delete().eq('id', image.id);

    toast({
      title: 'Image supprimée',
      description: 'L\'image a été retirée.',
    });

    onImagesChange();
  };

  const handleSetPrimary = async (image: PartImage) => {
    // Remove primary from all
    await supabase
      .from('part_images')
      .update({ is_primary: false })
      .eq('part_id', partId);

    // Set new primary
    await supabase
      .from('part_images')
      .update({ is_primary: true })
      .eq('id', image.id);

    onImagesChange();
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Images de la pièce</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Ajouter
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {images.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucune image. Cliquez sur "Ajouter" pour télécharger.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {images.map((image) => (
            <div
              key={image.id}
              className={cn(
                'relative group rounded-lg overflow-hidden border',
                image.is_primary && 'ring-2 ring-primary'
              )}
            >
              <img
                src={getImageUrl(image.storage_path)}
                alt={image.file_name}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!image.is_primary && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSetPrimary(image)}
                    title="Définir comme principale"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(image)}
                  title="Supprimer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {image.is_primary && (
                <div className="absolute top-1 left-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

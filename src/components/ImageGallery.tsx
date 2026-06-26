import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PartImage {
  id: string;
  storage_path: string;
  file_name: string;
  is_primary: boolean;
  display_order: number;
}

interface ImageGalleryProps {
  images: PartImage[];
  className?: string;
}

export function ImageGallery({ images, className }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('part-images').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  // Sort images: primary first, then by display_order
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.display_order - b.display_order;
  });

  if (images.length === 0) {
    return (
      <div className={cn('border rounded-lg p-8 text-center bg-secondary/30', className)}>
        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucune image disponible</p>
      </div>
    );
  }

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1));
  };

  const mainImage = sortedImages[selectedIndex];

  return (
    <>
      <div className={cn('space-y-3', className)}>
        {/* Main image */}
        <div
          className="relative aspect-square rounded-lg overflow-hidden bg-secondary cursor-pointer group"
          onClick={() => setIsOpen(true)}
        >
          <img
            src={getImageUrl(mainImage.storage_path)}
            alt={mainImage.file_name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>

        {/* Thumbnails */}
        {sortedImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortedImages.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all',
                  index === selectedIndex
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-muted-foreground/30'
                )}
              >
                <img
                  src={getImageUrl(image.storage_path)}
                  alt={image.file_name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            <img
              src={getImageUrl(sortedImages[selectedIndex].storage_path)}
              alt={sortedImages[selectedIndex].file_name}
              className="max-w-full max-h-[80vh] object-contain"
            />

            {sortedImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 text-white hover:bg-white/20"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 text-white hover:bg-white/20"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Image counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
              {selectedIndex + 1} / {sortedImages.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

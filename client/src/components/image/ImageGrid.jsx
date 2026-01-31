import { useState, useEffect, useCallback, memo } from 'react';
import { Download, Trash2, Maximize2, X, Image as ImageIcon } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Spinner } from '../ui/Spinner';
import { formatFileSize, formatRelativeTime, downloadBlob } from '../../utils/helpers';

// Individual image item
const ImageItem = memo(({ image, onView, onDownload, onDelete }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { requestImage } = useSession();

  // Load thumbnail
  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      try {
        const result = await requestImage(image.id);
        if (mounted && result?.image?.buffer) {
          const blob = new Blob([result.image.buffer], { type: image.mimeType });
          const url = URL.createObjectURL(blob);
          setThumbnail(url);
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
      if (thumbnail) {
        URL.revokeObjectURL(thumbnail);
      }
    };
  }, [image.id, image.mimeType, requestImage]);

  return (
    <div className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 image-grid-item animate-scale-in">
      {/* Image */}
      <div 
        className="aspect-square cursor-pointer"
        onClick={() => onView(image)}
      >
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={image.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Overlay with info and actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {/* File info */}
          <div className="mb-2">
            <p className="text-sm font-medium truncate">{image.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(image.size)} • {formatRelativeTime(image.uploadedAt)}
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(image);
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* View button (always visible) */}
      <button
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onView(image)}
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
});

ImageItem.displayName = 'ImageItem';

export function ImageGrid() {
  const { images, requestImage, deleteImage } = useSession();
  const [viewingImage, setViewingImage] = useState(null);
  const [viewingImageUrl, setViewingImageUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load full image when viewing
  useEffect(() => {
    if (!viewingImage) {
      if (viewingImageUrl) {
        URL.revokeObjectURL(viewingImageUrl);
        setViewingImageUrl(null);
      }
      return;
    }

    let mounted = true;

    const loadImage = async () => {
      try {
        const result = await requestImage(viewingImage.id);
        if (mounted && result?.image?.buffer) {
          const blob = new Blob([result.image.buffer], { type: viewingImage.mimeType });
          const url = URL.createObjectURL(blob);
          setViewingImageUrl(url);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [viewingImage, requestImage]);

  const handleView = useCallback((image) => {
    setViewingImage(image);
  }, []);

  const handleDownload = useCallback(async (image) => {
    setIsDownloading(true);
    try {
      const result = await requestImage(image.id);
      if (result?.image?.buffer) {
        const blob = new Blob([result.image.buffer], { type: image.mimeType });
        downloadBlob(blob, image.filename);
      }
    } catch (err) {
      console.error('Failed to download image:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [requestImage]);

  const handleDelete = useCallback(async (image) => {
    try {
      await deleteImage(image.id);
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  }, [deleteImage]);

  const closeViewer = useCallback(() => {
    setViewingImage(null);
  }, []);

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No images yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload or share images to see them here
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image) => (
          <ImageItem
            key={image.id}
            image={image}
            onView={handleView}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Image Viewer Modal */}
      <Dialog open={!!viewingImage} onOpenChange={closeViewer}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-white/10">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={closeViewer}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
              {viewingImageUrl ? (
                <img
                  src={viewingImageUrl}
                  alt={viewingImage?.filename}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : (
                <Spinner size="xl" />
              )}
            </div>

            {/* Footer with info and actions */}
            {viewingImage && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{viewingImage.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(viewingImage.size)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDownload(viewingImage)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

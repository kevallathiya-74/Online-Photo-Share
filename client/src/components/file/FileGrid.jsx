import { useState, useEffect, useCallback, memo } from 'react';
import { Download, Trash2, Maximize2, X, FileIcon, FileText, Film, Music, Archive, File } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Spinner } from '../ui/Spinner';
import { formatFileSize, formatRelativeTime, downloadBlob } from '../../utils/helpers';

// Get icon for file type
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return FileIcon;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return Archive;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return FileText;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return FileText;
  return File;
}

// Check if file can be previewed
function canPreview(mimeType) {
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType.startsWith('audio/') ||
         mimeType === 'application/pdf';
}

// Individual file item
const FileItem = memo(({ file, onView, onDownload, onDelete }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { requestFile } = useSession();
  const isImage = file.mimeType.startsWith('image/');
  const Icon = getFileIcon(file.mimeType);

  // Load thumbnail for images
  useEffect(() => {
    if (!isImage) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const loadThumbnail = async () => {
      try {
        const result = await requestFile(file.id);
        if (mounted && result?.file?.buffer) {
          const blob = new Blob([result.file.buffer], { type: file.mimeType });
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
  }, [file.id, file.mimeType, isImage, requestFile]);

  return (
    <div className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 image-grid-item animate-scale-in">
      {/* File Preview/Icon */}
      <div 
        className="aspect-square cursor-pointer"
        onClick={() => canPreview(file.mimeType) ? onView(file) : onDownload(file)}
      >
        {isImage ? (
          isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : thumbnail ? (
            <img
              src={thumbnail}
              alt={file.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon className="h-12 w-12 text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <Icon className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-xs text-center text-muted-foreground truncate w-full">
              {file.filename}
            </p>
          </div>
        )}
      </div>

      {/* Overlay with info and actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {/* File info */}
          <div className="mb-2">
            <p className="text-sm font-medium truncate">{file.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} • {formatRelativeTime(file.uploadedAt)}
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
                onDownload(file);
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
                onDelete(file);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* View button (for previewable files) */}
      {canPreview(file.mimeType) && (
        <button
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onView(file)}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

FileItem.displayName = 'FileItem';

export function FileGrid() {
  const { files, requestFile, deleteFile } = useSession();
  const [viewingFile, setViewingFile] = useState(null);
  const [viewingFileUrl, setViewingFileUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load full file when viewing
  useEffect(() => {
    if (!viewingFile) {
      if (viewingFileUrl) {
        URL.revokeObjectURL(viewingFileUrl);
        setViewingFileUrl(null);
      }
      return;
    }

    let mounted = true;

    const loadFile = async () => {
      try {
        const result = await requestFile(viewingFile.id);
        if (mounted && result?.file?.buffer) {
          const blob = new Blob([result.file.buffer], { type: viewingFile.mimeType });
          const url = URL.createObjectURL(blob);
          setViewingFileUrl(url);
        }
      } catch (err) {
        console.error('Failed to load file:', err);
      }
    };

    loadFile();

    return () => {
      mounted = false;
    };
  }, [viewingFile, requestFile]);

  const handleView = useCallback((file) => {
    setViewingFile(file);
  }, []);

  const handleDownload = useCallback(async (file) => {
    setIsDownloading(true);
    try {
      const result = await requestFile(file.id);
      if (result?.file?.buffer) {
        const blob = new Blob([result.file.buffer], { type: file.mimeType });
        downloadBlob(blob, file.filename);
      }
    } catch (err) {
      console.error('Failed to download file:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [requestFile]);

  const handleDelete = useCallback(async (file) => {
    try {
      await deleteFile(file.id);
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }, [deleteFile]);

  const closeViewer = useCallback(() => {
    setViewingFile(null);
  }, []);

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
          <FileIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No files yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload or share files to see them here
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map(file => (
          <FileItem
            key={file.id}
            file={file}
            onView={handleView}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* File Viewer Dialog */}
      {viewingFile && (
        <Dialog open={!!viewingFile} onOpenChange={closeViewer}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{viewingFile.filename}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(viewingFile.size)} • {new Date(viewingFile.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDownload(viewingFile)}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* File Preview */}
              {viewingFileUrl ? (
                <div className="rounded-lg overflow-hidden bg-black/20">
                  {viewingFile.mimeType.startsWith('image/') && (
                    <img
                      src={viewingFileUrl}
                      alt={viewingFile.filename}
                      className="w-full h-auto max-h-[70vh] object-contain"
                    />
                  )}
                  {viewingFile.mimeType.startsWith('video/') && (
                    <video
                      src={viewingFileUrl}
                      controls
                      className="w-full max-h-[70vh]"
                    />
                  )}
                  {viewingFile.mimeType.startsWith('audio/') && (
                    <div className="p-8">
                      <audio src={viewingFileUrl} controls className="w-full" />
                    </div>
                  )}
                  {viewingFile.mimeType === 'application/pdf' && (
                    <iframe
                      src={viewingFileUrl}
                      className="w-full h-[70vh]"
                      title={viewingFile.filename}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="xl" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

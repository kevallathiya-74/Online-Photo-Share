import { useState, useEffect, useCallback, memo } from 'react';
import { Download, Trash2, Maximize2, X, FileIcon, FileText, Film, Music, Archive, File } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/Dialog';
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
  const isVideo = file.mimeType.startsWith('video/');
  const hasVisualPreview = isImage || isVideo;
  const Icon = getFileIcon(file.mimeType);

  // Load thumbnail for images and videos
  useEffect(() => {
    if (!hasVisualPreview) {
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

          if (isVideo) {
            // Generate video thumbnail
            const video = document.createElement('video');
            video.src = url;
            video.currentTime = 1; // Seek to 1 second for thumbnail
            video.muted = true;

            video.onloadeddata = () => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0);

              canvas.toBlob((thumbBlob) => {
                if (thumbBlob && mounted) {
                  const thumbUrl = URL.createObjectURL(thumbBlob);
                  setThumbnail(thumbUrl);
                  URL.revokeObjectURL(url);
                }
              }, 'image/jpeg', 0.8);
            };

            video.onerror = () => {
              if (mounted) {
                setThumbnail(url); // Fallback to video URL
              }
            };
          } else {
            // For images, use the blob URL directly
            setThumbnail(url);
          }
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
  }, [file.id, file.mimeType, hasVisualPreview, isVideo, requestFile]);

  return (
    <div className="group relative rounded-xl overflow-hidden bg-muted/50 border border-border image-grid-item animate-scale-in">
      {/* File Preview/Icon */}
      <div
        className="aspect-square cursor-pointer relative"
        onClick={() => canPreview(file.mimeType) ? onView(file) : onDownload(file)}
      >
        {hasVisualPreview ? (
          isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-black/20 dark:bg-black/40">
              <Spinner size="lg" />
            </div>
          ) : thumbnail ? (
            <>
              <img
                src={thumbnail}
                alt={file.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 rounded-full p-3">
                    <Film className="h-8 w-8 text-white" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/20 dark:bg-black/40">
              <Icon className="h-12 w-12 text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-muted/30">
            <div className="bg-accent rounded-2xl p-4 mb-3">
              <Icon className="h-12 w-12 text-foreground/80" />
            </div>
            <p className="text-xs text-center text-muted-foreground font-medium truncate w-full px-2">
              {file.filename}
            </p>
            <p className="text-xs text-center text-muted-foreground/70 mt-1">
              {formatFileSize(file.size)}
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
        downloadBlob(blob, file.filename); // downloadBlob handles its own cleanup
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
    // Clean up blob URL before closing
    if (viewingFileUrl) {
      URL.revokeObjectURL(viewingFileUrl);
      setViewingFileUrl(null);
    }
    setViewingFile(null);
  }, [viewingFileUrl]);

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
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
            <DialogTitle className="sr-only">{viewingFile.filename}</DialogTitle>
            <DialogDescription className="sr-only">
              File preview for {viewingFile.filename} - {formatFileSize(viewingFile.size)}
            </DialogDescription>
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
                <div className="rounded-lg overflow-hidden bg-muted/30">
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
                      preload="metadata"
                      playsInline
                      className="w-full max-h-[70vh] bg-black"
                      onError={(e) => {
                        console.error('Video playback error:', e);
                      }}
                    >
                      Your browser does not support video playback.
                    </video>
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

import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, FileIcon, X, AlertCircle, File } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { FILE_CONFIG } from '../../utils/constants';
import { formatFileSize } from '../../utils/helpers';
import { cn } from '../../utils/helpers';

export function FileUpload() {
  const { uploadFile, session } = useSession();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const validateFile = (file) => {
    // No MIME type restrictions - accept all files
    if (file.size > FILE_CONFIG.MAX_SIZE_BYTES) {
      return `${file.name}: File too large (max ${formatFileSize(FILE_CONFIG.MAX_SIZE_BYTES)})`;
    }
    return null;
  };

  const processFiles = useCallback(async (files) => {
    const fileList = Array.from(files);
    const newErrors = [];
    const validFiles = [];

    // Validate files
    for (const file of fileList) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
      setTimeout(() => setErrors([]), 5000);
    }

    // Upload valid files
    for (const file of validFiles) {
      const id = `${Date.now()}-${file.name}`;
      
      setUploadQueue(prev => [...prev, { id, name: file.name, progress: 0 }]);
      
      try {
        await uploadFile(file);
        setUploadQueue(prev => prev.filter(item => item.id !== id));
      } catch (err) {
        setErrors(prev => [...prev, `${file.name}: ${err.message}`]);
        setUploadQueue(prev => prev.filter(item => item.id !== id));
      }
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files?.length) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e) => {
    const files = e.target.files;
    if (files?.length) {
      processFiles(files);
    }
    // Reset input
    e.target.value = '';
  }, [processFiles]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
      // Accept any file type from clipboard
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // Listen for paste events
  useState(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  if (!session) return null;

  return (
    <div className="space-y-4">
      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'upload-zone text-center',
          isDragging && 'dragging'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className={cn(
              'p-4 rounded-full transition-colors',
              isDragging ? 'bg-primary/20' : 'bg-white/5'
            )}>
              <Upload className={cn(
                'h-8 w-8 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
          </div>
          
          <div>
            <p className="font-medium">
              {isDragging ? 'Drop files here' : 'Drag & drop any files'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse • Paste from clipboard
            </p>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Images, videos, PDFs, documents, and more
            <br />
            Max {formatFileSize(FILE_CONFIG.MAX_SIZE_BYTES)} per file
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <File className="h-4 w-4 mr-2" />
          Browse Files
        </Button>
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          Camera
        </Button>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map(item => (
            <div 
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <Spinner size="sm" />
              <span className="text-sm truncate flex-1">{item.name}</span>
              <span className="text-xs text-muted-foreground">Uploading...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

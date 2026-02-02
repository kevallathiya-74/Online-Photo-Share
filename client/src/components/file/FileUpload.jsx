import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Camera, FileIcon, X, AlertCircle, File, CheckCircle } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { CameraCapture } from '../camera';
import { FILE_CONFIG } from '../../utils/constants';
import { formatFileSize } from '../../utils/helpers';
import { cn } from '../../utils/helpers';

export function FileUpload({ onUploadSuccess }) {
  const { uploadFile, session } = useSession();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [errors, setErrors] = useState([]);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        // Check if getUserMedia is supported
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          setCameraSupported(true);
        } else {
          // Fallback: check if input[capture] is supported (mobile)
          const input = document.createElement('input');
          input.setAttribute('capture', 'camera');
          setCameraSupported('capture' in input);
        }
      } catch (err) {
        setCameraSupported(false);
      }
    };
    checkCameraSupport();
  }, []);

  const validateFile = (file) => {
    // No MIME type restrictions - accept all files
    if (file.size > FILE_CONFIG.MAX_SIZE_BYTES) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      const maxSizeMB = (FILE_CONFIG.MAX_SIZE_BYTES / 1024 / 1024).toFixed(0);
      return `${file.name} is ${fileSizeMB}MB, which exceeds the ${maxSizeMB}MB limit. Please choose a smaller file.`;
    }
    if (file.size === 0) {
      return `${file.name} is empty and cannot be uploaded.`;
    }
    return null;
  };

  const processFiles = useCallback(async (files) => {
    if (!session) {
      setErrors(prev => [...prev, 'Please create or join a session before uploading files.']);
      setTimeout(() => setErrors([]), 5000);
      return;
    }

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
      setTimeout(() => setErrors(prev => prev.filter(e => !newErrors.includes(e))), 7000);
    }

    // Upload valid files with progress tracking
    for (const file of validFiles) {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setUploadQueue(prev => [...prev, { 
        id, 
        name: file.name, 
        size: file.size,
        progress: 0,
        status: 'uploading'
      }]);
      
      try {
        // Use real progress tracking from chunked upload
        await uploadFile(file, (progress, status) => {
          setUploadQueue(prev => prev.map(item => 
            item.id === id ? { ...item, progress, status } : item
          ));
        });
        
        // Notify parent of successful upload (triggers sidebar close on mobile)
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        
        // Remove from queue after success
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => item.id !== id));
        }, 2000);
        
      } catch (err) {
        const errorMessage = err.message || 'Upload failed. Please check your connection and try again.';
        setErrors(prev => [...prev, `${file.name}: ${errorMessage}`]);
        setUploadQueue(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'error', progress: 0 } : item
        ));
        
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => item.id !== id));
          setErrors(prev => prev.filter(e => !e.includes(file.name)));
        }, 7000);
      }
    }
  }, [uploadFile, session, onUploadSuccess]);

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

  // Open camera capture
  const handleOpenCamera = useCallback(() => {
    setIsCameraOpen(true);
  }, []);

  // Handle captured photo from camera
  const handleCameraCapture = useCallback((file) => {
    processFiles([file]);
  }, [processFiles]);

  // Close camera
  const handleCloseCamera = useCallback(() => {
    setIsCameraOpen(false);
  }, []);

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
              or click to browse • paste with Ctrl+V • up to 100MB per file
            </p>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileIcon className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
            
            {cameraSupported && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCamera();
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
                
                {/* Hidden camera input as fallback */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Queue with Progress */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
            >
              {item.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : item.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              ) : (
                <Spinner size="sm" className="flex-shrink-0" />
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-300 rounded-full",
                        item.status === 'success' ? 'bg-green-500' :
                        item.status === 'error' ? 'bg-red-500' :
                        'bg-primary'
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.status === 'success' ? 'Done' :
                     item.status === 'error' ? 'Failed' :
                     `${item.progress}%`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Camera Capture Component */}
      <CameraCapture
        isOpen={isCameraOpen}
        onCapture={handleCameraCapture}
        onClose={handleCloseCamera}
      />
    </div>
  );
}

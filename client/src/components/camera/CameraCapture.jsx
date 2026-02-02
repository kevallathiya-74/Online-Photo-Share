import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RotateCw, Check, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';

/**
 * CameraCapture - Full-screen native-like camera experience
 * 
 * Features:
 * - Full viewport coverage with proper aspect ratio
 * - Front/back camera switching
 * - Capture preview with retake/confirm
 * - Proper media stream cleanup
 * - Responsive across all devices
 * - Graceful error handling
 */
export function CameraCapture({ onCapture, onClose, isOpen }) {
  // Camera states
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' = front, 'environment' = back
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Capture states
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  /**
   * Initialize camera stream
   */
  const initializeCamera = useCallback(async (mode = facingMode) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      
    } catch (err) {
      console.error('Camera initialization error:', err);
      
      // User-friendly error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Requested camera mode is not available.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera is not supported in this browser.');
      } else {
        setError('Failed to access camera. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, stream]);
  
  /**
   * Switch between front and back camera
   */
  const switchCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    initializeCamera(newMode);
  }, [facingMode, initializeCamera]);
  
  /**
   * Capture photo from video stream
   */
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !stream) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and data URL
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        setCapturedBlob(blob);
        
        // Pause video stream while reviewing
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    }, 'image/jpeg', 0.95);
  }, [stream]);
  
  /**
   * Retake photo - return to camera view
   */
  const retakePhoto = useCallback(() => {
    // Cleanup previous capture
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    
    setCapturedImage(null);
    setCapturedBlob(null);
    
    // Resume video stream
    if (videoRef.current && stream) {
      videoRef.current.play();
    }
  }, [capturedImage, stream]);
  
  /**
   * Confirm and upload photo
   */
  const confirmPhoto = useCallback(() => {
    if (!capturedBlob) return;
    
    // Create File object from blob
    const fileName = `camera-${Date.now()}.jpg`;
    const file = new window.File([capturedBlob], fileName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
    
    onCapture(file);
    handleClose();
  }, [capturedBlob, onCapture]);
  
  /**
   * Close camera and cleanup
   */
  const handleClose = useCallback(() => {
    // Stop all media tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Cleanup captured image
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
    }
    
    setCapturedBlob(null);
    setError(null);
    
    onClose();
  }, [stream, capturedImage, onClose]);
  
  /**
   * Attach stream to video element when stream is available
   */
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  /**
   * Initialize camera when opened
   */
  useEffect(() => {
    if (isOpen && !stream && !error) {
      initializeCamera();
    }
  }, [isOpen, stream, error, initializeCamera]);
  
  /**
   * Prevent body scroll when camera is open
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [stream, capturedImage]);
  
  // Don't render if not open
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera View */}
      {!capturedImage ? (
        <div className="relative w-full h-full flex flex-col">
          {/* Video Stream */}
          <div className="relative flex-1 overflow-hidden">
            {error ? (
              // Error State
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <Alert variant="destructive" className="max-w-md">
                  <XCircle className="h-5 w-5" />
                  <AlertDescription className="mt-2">
                    {error}
                  </AlertDescription>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => initializeCamera()}
                      className="flex-1"
                    >
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                      className="flex-1"
                    >
                      Close
                    </Button>
                  </div>
                </Alert>
              </div>
            ) : isLoading ? (
              // Loading State
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4" />
                  <p className="text-sm">Initializing camera...</p>
                </div>
              </div>
            ) : (
              // Video Preview
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            
            {/* Top Bar - Close & Switch Camera */}
            {!error && (
              <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-start z-10">
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all backdrop-blur-sm"
                  aria-label="Close camera"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                
                {/* Switch Camera Button */}
                {stream && (
                  <button
                    onClick={switchCamera}
                    className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all backdrop-blur-sm"
                    aria-label="Switch camera"
                  >
                    <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Bottom Controls - Capture Button */}
          {!error && stream && (
            <div className="relative p-6 sm:p-8 flex items-center justify-center bg-gradient-to-t from-black via-black/95 to-transparent">
              <button
                onClick={capturePhoto}
                disabled={isLoading}
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white hover:bg-gray-100 disabled:bg-gray-400 transition-all active:scale-90 shadow-2xl"
                aria-label="Capture photo"
              >
                <div className="absolute inset-2 rounded-full border-4 border-black/10" />
                <Camera className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-black/70" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Preview Captured Image
        <div className="relative w-full h-full flex flex-col">
          {/* Image Preview */}
          <div className="relative flex-1 overflow-hidden">
            <img
              src={capturedImage}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
            
            {/* Top Bar - Close Button */}
            <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-start z-10">
              <button
                onClick={handleClose}
                className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
          
          {/* Bottom Actions - Retake & Confirm */}
          <div className="relative p-6 sm:p-8 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-black via-black/95 to-transparent">
            {/* Retake Button */}
            <Button
              onClick={retakePhoto}
              size="lg"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm px-6 sm:px-8"
            >
              <X className="w-5 h-5 mr-2" />
              Retake
            </Button>
            
            {/* Confirm Button */}
            <Button
              onClick={confirmPhoto}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 sm:px-12"
            >
              <Check className="w-5 h-5 mr-2" />
              Use Photo
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body 
  );
}

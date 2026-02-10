import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Share2, Check, QrCode } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/Dialog';
import { generateShareUrl, copyToClipboard, formatRemainingTime, isWebShareSupported } from '../../utils/helpers';

export function SessionInfo({ session, memberCount }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [remainingTime, setRemainingTime] = useState('');

  const shareUrl = generateShareUrl(session.id);

  // Generate QR code
  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(setQrDataUrl).catch(console.error);
  }, [shareUrl]);

  // Update remaining time
  useEffect(() => {
    const updateTime = () => {
      setRemainingTime(formatRemainingTime(session.expiresAt));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [session.expiresAt]);

  const handleCopy = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (isWebShareSupported()) {
      try {
        await navigator.share({
          title: 'Join my FileShare session',
          text: 'Share files instantly - any type, any device!',
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Session Active</CardTitle>
            <CardDescription className="mt-1">
              {remainingTime}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-400 pulse-live" />
              {memberCount} {memberCount === 1 ? 'device' : 'devices'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Session ID Display */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <code className="flex-1 text-sm font-mono text-muted-foreground">
            {session.id}
          </code>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleShare}
            className="flex-1"
            variant="secondary"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="icon" className="qr-code-button">
                <QrCode className="h-4 w-4 qr-icon" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Scan to Join</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center py-6">
                {qrDataUrl && (
                  <div className="qr-container">
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                )}
                <p className="mt-4 text-sm text-muted-foreground text-center">
                  Scan this QR code with another device to join the session
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

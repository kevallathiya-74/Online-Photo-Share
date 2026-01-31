import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Wifi, WifiOff, Image as ImageIcon } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useSession } from '../../context/SessionContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';

export function SessionCreate({ onSessionCreated }) {
  const { isConnected, connectionError } = useSocket();
  const { createSession, joinSession, isLoading, error, clearError } = useSession();
  const [joinSessionId, setJoinSessionId] = useState('');
  const [mode, setMode] = useState('create'); // 'create' or 'join'
  const navigate = useNavigate();

  const handleCreate = async () => {
    try {
      clearError();
      const result = await createSession();
      if (onSessionCreated) {
        onSessionCreated(result);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinSessionId.trim()) return;

    try {
      clearError();
      await joinSession(joinSessionId.trim());
      if (onSessionCreated) {
        onSessionCreated({ sessionId: joinSessionId.trim() });
      }
    } catch (err) {
      console.error('Failed to join session:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25 mb-4">
            <ImageIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">ImageShare</h1>
          <p className="text-muted-foreground">
            Share images instantly across devices
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center">
          {isConnected ? (
            <Badge variant="success" className="flex items-center gap-2">
              <Wifi className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center gap-2">
              <WifiOff className="h-3 w-3" />
              Disconnected
            </Badge>
          )}
        </div>

        {/* Error Alert */}
        {(error || connectionError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || connectionError}</AlertDescription>
          </Alert>
        )}

        {/* Main Card */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create a new session or join an existing one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'create'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create Session
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'join'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Join Session
              </button>
            </div>

            {/* Create Mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Start a new session and share the link with others to receive images instantly.
                </p>
                <Button
                  onClick={handleCreate}
                  disabled={!isConnected || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Plus className="h-5 w-5 mr-2" />
                  )}
                  Create New Session
                </Button>
              </div>
            )}

            {/* Join Mode */}
            {mode === 'join' && (
              <form onSubmit={handleJoin} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the session ID to join and start sharing images.
                </p>
                <Input
                  type="text"
                  placeholder="Paste session ID here..."
                  value={joinSessionId}
                  onChange={(e) => setJoinSessionId(e.target.value)}
                  className="font-mono text-sm"
                  disabled={!isConnected || isLoading}
                />
                <Button
                  type="submit"
                  disabled={!isConnected || isLoading || !joinSessionId.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <LogIn className="h-5 w-5 mr-2" />
                  )}
                  Join Session
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl">🔒</div>
            <p className="text-xs text-muted-foreground">End-to-end secure</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl">⚡</div>
            <p className="text-xs text-muted-foreground">Real-time sync</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl">🗑️</div>
            <p className="text-xs text-muted-foreground">Auto-delete</p>
          </div>
        </div>
      </div>
    </div>
  );
}

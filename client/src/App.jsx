import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useSocket } from './context/SocketContext';
import { useSession } from './context/SessionContext';
import { SessionCreate, SessionInfo } from './components/session';
import { FileUpload, FileGrid } from './components/file';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Spinner } from './components/ui/Spinner';

export default function App() {
  const { isConnected } = useSocket();
  const { session, memberCount, isLoading, error, joinSession, leaveSession, clearError } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSidebar, setShowSidebar] = useState(false);
  const [initialJoinAttempted, setInitialJoinAttempted] = useState(false);

  // Handle session from URL (for sharing and PWA share target)
  useEffect(() => {
    const sessionId = searchParams.get('session');
    
    if (sessionId && !session && !initialJoinAttempted && isConnected) {
      setInitialJoinAttempted(true);
      joinSession(sessionId).catch((err) => {
        console.error('Failed to join session:', err);
        // Clear the session param on error
        setSearchParams({});
      });
    }
    
    // If no session in URL and not loading, show create page
    if (!sessionId && !session && !isLoading) {
      setInitialJoinAttempted(false);
    }
  }, [searchParams, session, initialJoinAttempted, isConnected, isLoading, joinSession, setSearchParams]);

  // Update URL when session changes
  useEffect(() => {
    if (session) {
      setSearchParams({ session: session.id });
    }
  }, [session, setSearchParams]);

  const handleLeave = () => {
    console.log('[App] handleLeave called, calling leaveSession');
    leaveSession();
    setSearchParams({});
    setInitialJoinAttempted(false);
    if (clearError) clearError();
  };

  // Show loading while trying to join from URL (only if there's a session param)
  if (isLoading && !session && searchParams.get('session')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner size="xl" />
          <p className="text-muted-foreground">Joining session...</p>
        </div>
      </div>
    );
  }

  // Show session create/join if no active session
  if (!session) {
    return <SessionCreate />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl safe-top">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/5"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-xl font-bold gradient-text">FileShare</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="info" className="hidden sm:flex">
              {memberCount} {memberCount === 1 ? 'device' : 'devices'}
            </Badge>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                console.log('[App] Leave clicked');
                leaveSession();
                setSearchParams({});
                setInitialJoinAttempted(false);
                if (clearError) clearError();
                window.location.href = '/';
              }}
              className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-accent transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Leave</span>
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Session Info & Upload */}
          <aside className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-80 lg:w-72 xl:w-80
            transform transition-transform duration-200 ease-out
            ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            bg-background lg:bg-transparent
            border-r border-white/10 lg:border-0
            p-4 lg:p-0 pt-20 lg:pt-0
            space-y-6
          `}>
            <SessionInfo session={session} memberCount={memberCount} />
            <FileUpload />
          </aside>

          {/* Overlay for mobile sidebar */}
          {showSidebar && (
            <div 
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setShowSidebar(false)}
            />
          )}

          {/* Main Content - Image Grid */}
          <main className="flex-1 min-w-0">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription className="flex items-center justify-between">
                  {error}
                  <button onClick={clearError} className="ml-2">
                    <X className="h-4 w-4" />
                  </button>
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-semibold">Shared Files</h2>
              <p className="text-sm text-muted-foreground">
                Files appear here instantly when shared by any device
              </p>
            </div>

            <FileGrid />
          </main>
        </div>
      </div>

      {/* Mobile bottom padding for safe area */}
      <div className="safe-bottom" />
    </div>
  );
}

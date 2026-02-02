import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useSocket } from './context/SocketContext';
import { useSession } from './context/SessionContext';
import { SessionCreate, SessionInfo } from './components/session';
import { FileUpload, FileGrid } from './components/file';
import { MessageInput, MessageList } from './components/message';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Spinner } from './components/ui/Spinner';

export default function App() {
  const { isConnected } = useSocket();
  const { 
    session, 
    messages, 
    memberCount, 
    isLoading, 
    error, 
    joinSession, 
    leaveSession, 
    sendMessage,
    deleteMessage,
    clearError 
  } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSidebar, setShowSidebar] = useState(false);
  const [initialJoinAttempted, setInitialJoinAttempted] = useState(false);
  const [view, setView] = useState('files'); // 'files' or 'messages'
  const [isLeaving, setIsLeaving] = useState(false);
  const leavingRef = useRef(false); // Use ref to block auto-join during leave

  // Auto-close sidebar on mobile after file upload success
  const handleUploadSuccess = () => {
    // Only close on mobile/tablet (< lg breakpoint)
    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  // Handle session from URL (for sharing and PWA share target)
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (leavingRef.current) {
      return;
    }
    
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

  // Update URL when session changes (but not when leaving)
  useEffect(() => {
    if (leavingRef.current) {
      return;
    }
    
    if (session && !isLeaving && !searchParams.get('session')) {
      setSearchParams({ session: session.id });
    }
  }, [session, setSearchParams, isLeaving]);

  const handleLeave = async () => {
    console.log('[App] Leave clicked');
    leavingRef.current = true;
    setIsLeaving(true);
    setInitialJoinAttempted(false);
    
    // Clear URL and leave session
    setSearchParams({});
    await leaveSession();
    
    if (clearError) clearError();
    setIsLeaving(false);
    
    setTimeout(() => {
      leavingRef.current = false;
    }, 100);
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
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log('[App] Leave clicked');
                handleLeave();
              }}
              className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-accent transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Leave</span>
            </button>
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
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </aside>

          {/* Overlay for mobile sidebar */}
          {showSidebar && (
            <div 
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setShowSidebar(false)}
            />
          )}

          {/* Main Content - Files or Messages */}
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

            {/* View Toggle */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {view === 'files' ? 'Shared Files' : 'Messages'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {view === 'files' 
                    ? 'Files appear here instantly when shared by any device'
                    : 'Send and receive text messages in real-time'
                  }
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={view === 'files' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('files')}
                >
                  Files
                </Button>
                <Button
                  variant={view === 'messages' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('messages')}
                >
                  Messages
                  {messages.length > 0 && (
                    <Badge variant="info" className="ml-2 px-2">
                      {messages.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* File Grid View */}
            {view === 'files' && <FileGrid />}

            {/* Messages View */}
            {view === 'messages' && (
              <div className="flex flex-col h-[calc(100vh-16rem)] border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm">
                <MessageList 
                  messages={messages}
                  currentUserId={isConnected ? session?.id : null}
                  onDeleteMessage={deleteMessage}
                  isSessionCreator={false}
                />
                <MessageInput 
                  onSendMessage={sendMessage}
                  disabled={!isConnected}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom padding for safe area */}
      <div className="safe-bottom" />
    </div>
  );
}

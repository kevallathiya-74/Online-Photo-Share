import { useEffect, useRef, useState } from 'react';
import { Copy, Trash2, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatDistanceToNow } from '../../utils/helpers';

/**
 * MessageList - Display messages with copy/delete functionality
 * Features: Auto-scroll, copy to clipboard, delete own messages, timestamps
 */
export function MessageList({ messages, currentUserId, onDeleteMessage, isSessionCreator }) {
  const listEndRef = useRef(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCopy = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleDelete = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      onDeleteMessage(messageId);
    }
  };

  const canDeleteMessage = (message) => {
    return message.sentBy === currentUserId || isSessionCreator;
  };

  const formatTimestamp = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No messages yet</p>
          <p className="text-sm">Start the conversation by sending a message below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((message) => {
        const isOwnMessage = message.sentBy === currentUserId;
        const canDelete = canDeleteMessage(message);
        const isCopied = copiedMessageId === message.id;

        return (
          <div
            key={message.id}
            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${isOwnMessage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground border border-border'
                }`}
            >
              {/* Sender name and timestamp */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span
                  className={`text-sm font-semibold ${isOwnMessage ? 'text-primary-foreground/90' : 'text-foreground/90'
                    }`}
                >
                  {isOwnMessage ? 'You' : message.sentByName}
                </span>
                <span
                  className={`text-xs ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                >
                  {formatTimestamp(message.sentAt)}
                </span>
              </div>

              {/* Message content */}
              <p className="whitespace-pre-wrap break-words mb-2">
                {message.content}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-1 justify-end">
                <Button
                  onClick={() => handleCopy(message)}
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 ${isOwnMessage
                      ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  title="Copy message"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>

                {canDelete && (
                  <Button
                    onClick={() => handleDelete(message.id)}
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${isOwnMessage
                        ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={listEndRef} />
    </div>
  );
}

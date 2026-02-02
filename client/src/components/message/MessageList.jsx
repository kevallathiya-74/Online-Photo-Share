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
      <div className="flex-1 flex items-center justify-center p-8 text-gray-500">
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
              className={`max-w-[70%] rounded-lg p-3 ${
                isOwnMessage
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* Sender name and timestamp */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span
                  className={`text-sm font-semibold ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-700'
                  }`}
                >
                  {isOwnMessage ? 'You' : message.sentByName}
                </span>
                <span
                  className={`text-xs ${
                    isOwnMessage ? 'text-blue-200' : 'text-gray-500'
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
                  className={`h-7 px-2 ${
                    isOwnMessage
                      ? 'text-blue-100 hover:text-white hover:bg-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
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
                    className={`h-7 px-2 ${
                      isOwnMessage
                        ? 'text-blue-100 hover:text-white hover:bg-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
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

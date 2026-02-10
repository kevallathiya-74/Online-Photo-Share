import { useState, useRef, useEffect } from 'react';
import { Send, Clipboard } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * MessageInput - Input component for sending text messages
 * Features: Auto-resize textarea, paste support, Enter to send
 */
export function MessageInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const isEmpty = message.trim().length === 0;
  const canSend = !isEmpty && !disabled;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMessage(message + text);
        setError('');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setError('Failed to paste from clipboard. Please try again.');
    }
  };

  const handleSend = () => {
    if (!canSend) return;

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      setError('Message cannot be empty');
      return;
    }

    onSendMessage(trimmedMessage);
    setMessage('');
    setError('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    setError('');
  };

  return (
    <div className="border-t border-border bg-accent/50 p-4">
      <div className="mb-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
          className={`w-full px-3 py-2 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] max-h-[200px] overflow-y-auto text-foreground placeholder:text-muted-foreground bg-muted ${disabled ? 'bg-accent/50 cursor-not-allowed opacity-50' : ''
            }`}
          rows={1}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {error && (
          <span className="text-sm text-red-400">
            {error}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            onClick={handlePaste}
            disabled={disabled}
            variant="outline"
            size="sm"
            title="Paste from clipboard"
          >
            <Clipboard className="w-4 h-4 mr-1" />
            Paste
          </Button>

          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="sm"
            title={isEmpty ? 'Message cannot be empty' : 'Send message (Enter)'}
          >
            <Send className="w-4 h-4 mr-1" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

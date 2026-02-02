import { useState, useRef, useEffect } from 'react';
import { Send, Clipboard } from 'lucide-react';
import { Button } from '../ui/Button';

const MAX_MESSAGE_LENGTH = 10000;

/**
 * MessageInput - Input component for sending text messages
 * Features: Auto-resize textarea, character counter, paste support, Enter to send
 */
export function MessageInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const characterCount = message.length;
  const isOverLimit = characterCount > MAX_MESSAGE_LENGTH;
  const isEmpty = message.trim().length === 0;
  const canSend = !isEmpty && !isOverLimit && !disabled;

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
        const newMessage = message + text;
        if (newMessage.length > MAX_MESSAGE_LENGTH) {
          setError(`Text is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`);
        } else {
          setMessage(newMessage);
          setError('');
        }
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

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`);
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
    
    if (newValue.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`);
    } else {
      setError('');
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="mb-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] max-h-[200px] overflow-y-auto text-gray-900 placeholder:text-gray-400 ${
            isOverLimit ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          rows={1}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm ${
              isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'
            }`}
          >
            {characterCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
          </span>
          
          {error && (
            <span className="text-sm text-red-600">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            title={
              isEmpty
                ? 'Message cannot be empty'
                : isOverLimit
                ? 'Message is too long'
                : 'Send message (Enter)'
            }
          >
            <Send className="w-4 h-4 mr-1" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

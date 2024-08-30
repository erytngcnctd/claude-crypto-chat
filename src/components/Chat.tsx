import React from 'react';
import { Message } from '../types';

interface ChatProps {
  conversation: Message[];
  onSendMessage: (message: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ conversation, onSendMessage }) => {
  const [input, setInput] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container flex flex-col h-full">
      <div className="messages-container flex-1 overflow-y-auto pb-4">
        {conversation.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-bubble">
              {typeof message.content === 'string' 
                ? message.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < message.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))
                : JSON.stringify(message.content)}
            </div>
          </div>
        ))}
      </div>
      <div className="chat fixed bottom-0 left-0 right-0 bg-white border-t">
        <form onSubmit={handleSubmit} className="chat-form p-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="chat-input w-full p-2 border rounded-lg"
          />
          <button type="submit" className="chat-send-button mt-2 w-full bg-blue-500 text-white p-2 rounded-lg">Send</button>
        </form>
      </div>
    </div>
  );
};
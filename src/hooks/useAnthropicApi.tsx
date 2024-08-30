import axios from 'axios';
import { useState } from 'react';
import { Conversation, Message, Tool } from '../types';

export const useAnthropicAPI = (tools: Tool[]) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string, conversation: Message[]) => {
    try {
      // Ensure conversation is an array
      let messages = Array.isArray(conversation) ? conversation : [];
      
      // Add the new user message
      messages.push({ role: 'user', content: message });

      // Ensure messages alternate between 'user' and 'assistant'
      messages = messages.reduce((acc: Message[], curr: Message, index: number) => {
        if (index === 0 || curr.role !== acc[acc.length - 1].role) {
          acc.push(curr);
        } else if (curr.role === 'user') {
          acc[acc.length - 1].content += '\n' + curr.content;
        }
        return acc;
      }, []);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: messages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  const executeTools = async (toolRequest: { tool: string; input: any }) => {
    const tool = tools.find(t => t.name === toolRequest.tool);
    if (tool) {
      return await tool.execute(toolRequest.input);
    }
    throw new Error(`Tool ${toolRequest.tool} not found`);
  };

  return { sendMessage, executeTools, isLoading, error };
};
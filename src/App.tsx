import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { TokenUsage } from './components/TokenUsage';
import { useAnthropicAPI } from './hooks/useAnthropicApi';
import { Conversation as ImportedConversation, Tool } from './types';
import { WagmiConfig, createConfig, configureChains, mainnet } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { useConnect, useDisconnect, useAccount, useBalance, useSendTransaction } from 'wagmi';
import { create } from 'zustand';

// Define the store
interface WalletStore {
  address: string | undefined;
  setAddress: (address: string | undefined) => void;
}

const useWalletStore = create<WalletStore>((set) => ({
  address: undefined,
  setAddress: (address) => set({ address }),
}));

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

const App: React.FC = () => {
  return (
    <WagmiConfig config={config}>
      <AppContent />
    </WagmiConfig>
  );
};

// Update the Conversation type
type MessageRole = 'user' | 'assistant';
interface Message {
  role: MessageRole;
  content: string;
}

interface Conversation {
  messages: Message[];
  systemPrompt?: string;
}

const AppContent: React.FC = () => {
  const [conversation, setConversation] = useState<Conversation>({
    messages: [],
    systemPrompt: "You are a helpful AI assistant.",
  });
  const [tokenUsage, setTokenUsage] = useState({
    mainModel: { input: 0, output: 0 },
    toolChecker: { input: 0, output: 0 },
  });

  const { address, setAddress } = useWalletStore();
  
  const { connect } = useConnect({
    connector: new InjectedConnector(),
    onSuccess(data) {
      setAddress(data.account);
      localStorage.setItem('walletAddress', data.account);
    },
  });
  
  const { disconnect } = useDisconnect({
    onSuccess() {
      setAddress(undefined);
      localStorage.removeItem('walletAddress');
    },
  });
  
  const { data: balance } = useBalance({ 
    address: address as `0x${string}` | undefined 
  });
  const { sendTransactionAsync } = useSendTransaction();


  const getAddress = async () => {
    return address
  };

  const getBalance = async (address: string) => {
    return balance ? balance.formatted : '0';
  };

  const sendEth = async ({ to, value }: { to: string; value: string }) => {
    console.log('sendEth called with:', { to, value });
    if (!to) {
      throw new Error('Recipient address for ETH transfer is undefined or empty');
    }
    if (!value) {
      throw new Error('Value for ETH transfer is undefined or empty');
    }
    const bigIntValue = BigInt(value);
    if (bigIntValue <= 0) {
      throw new Error('Value for ETH transfer must be greater than 0');
    }
    const result = await sendTransactionAsync({ to, value: bigIntValue });
    return result;
  };
  
  const tools: Tool[] = [
    { name: 'get_wallet_address', execute: getAddress },
    { name: 'get_balance', execute: getBalance },
    { name: 'send_eth', execute: sendEth },
  ];

  const { sendMessage } = useAnthropicAPI(tools);


  const handleSendMessage = async (message: string) => {
    try {
      const response = await sendMessage(message, conversation.messages);
      console.log('Full response:', JSON.stringify(response, null, 2));

      let assistantContent = '';

      if (response && typeof response === 'object' && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === 'text') {
            assistantContent += item.text + '\n\n';
          } else if (item.type === 'tool_use') {
            const result = await handleToolUse(item.name, item.input, item.id);
            assistantContent += `Result: ${result}\n`;
          }
        }
      }

      // Update token usage
      if (response.usage) {
        setTokenUsage(prevUsage => ({
          ...prevUsage,
          mainModel: {
            input: prevUsage.mainModel.input + response.usage.input_tokens,
            output: prevUsage.mainModel.output + response.usage.output_tokens
          }
        }));
      }

      // Update conversation state
      if (assistantContent.trim()) {
        setConversation(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'assistant', content: assistantContent.trim() }]
        }));
      }

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error executing message:', error);
        // Don't add system messages to the conversation
      }
      throw error;
    }
  };

  const handleToolUse = async (toolName: string, toolInput: any, toolUseId: string) => {
    console.log(`Executing tool: ${toolName} with input:`, toolInput);
    const tool = tools.find(t => t.name === toolName);
    if (tool) {
      try {
        // For send_eth, ensure the input is properly formatted
        if (toolName === 'send_eth' && typeof toolInput === 'string') {
          try {
            toolInput = JSON.parse(toolInput);
          } catch (e) {
            console.error('Failed to parse send_eth input:', e);
          }
        }
        
        if (toolName === 'send_eth' && (!toolInput.to || !toolInput.value)) {
          throw new Error('Invalid input for send_eth: missing to or value');
        }

        const result = await tool.execute(toolInput);
        console.log(`Tool ${toolName} result:`, result);
        
        // Prepare the tool use response
        const toolUseResponse = {
          tool_use_id: toolUseId,
          content: JSON.stringify(result),
        };

        // Send the tool use response back to the Anthropic API
        await sendMessage(JSON.stringify(toolUseResponse), conversation.messages);

        // setConversation(prev => ({
        //   ...prev,
        //   messages: [...prev.messages, { role: 'assistant', content: `Tool ${toolName} result: ${JSON.stringify(result)}` }]
        // }));
        return result;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const errorResponse = {
            tool_use_id: toolUseId,
            content: error.message,
            is_error: true,
          };
          
          // Send the error response back to the Anthropic API
          await sendMessage(JSON.stringify(errorResponse), conversation.messages);

          setConversation(prev => ({
            ...prev,
            messages: [...prev.messages, { role: 'assistant', content: `Error executing tool ${toolName}: ${error.message}` }]
          }));
        }
        throw error;
      }
    }
    throw new Error(`Tool ${toolName} not found`);
  };

  const handleReset = () => {
    setConversation({
      messages: [],
      systemPrompt: "You are a helpful AI assistant.",
    });
    setTokenUsage({
      mainModel: { input: 0, output: 0 },
      toolChecker: { input: 0, output: 0 },
    });
  };

  const onSendMessage = (message: string) => {
    setConversation(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: message }]
    }));
    handleSendMessage(message);
  };

  // Check if connected on load
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
    }
  }, [setAddress]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="connect-button-container">
          {address ? (
            <>
              <span className="address-display">
                {`${address.slice(0, 5)}...${address.slice(-5)}`}
              </span> 
              <button onClick={() => disconnect()} className="connect-button">Disconnect</button>
            </>
          ) : (
            <button onClick={() => connect()} className="connect-button">Connect Wallet</button>
          )}
        </div>
      </header>
      <Chat conversation={conversation.messages} onSendMessage={onSendMessage} />
    </div>
  );
};

export default App;
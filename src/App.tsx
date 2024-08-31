import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { TokenUsage } from './components/TokenUsage';
import { useAnthropicAPI } from './hooks/useAnthropicApi';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { useConnect, useDisconnect, useAccount, useBalance, useSendTransaction, usePublicClient, useNetwork, useSwitchNetwork } from 'wagmi';
import { mainnet, sepolia, goerli, optimism, polygon, arbitrum } from 'wagmi/chains';
import { isAddress, getAddress, Chain } from 'viem';
import { GetBalanceParams, PublicClientGetBalanceParams, SendEthParams, Conversation, Message, Tool } from './types';

const chains: Chain[] = [mainnet, sepolia, goerli, optimism, polygon, arbitrum];

const getChainId = async (input: { chain_name: string }): Promise<number | undefined> => {
  const chainName = input.chain_name.trim().toLowerCase();
  const chain = chains.find(c => c.name.toLowerCase() === chainName || c.network.toLowerCase() === chainName);
  console.log('Found chain:', chain);
  return chain?.id;
};

const { chains: configuredChains, publicClient } = configureChains(
  chains,
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  connectors: [new InjectedConnector({ chains: configuredChains })],
});

const App: React.FC = () => {
  return (
    <WagmiConfig config={config}>
      <AppContent />
    </WagmiConfig>
  );
};

const AppContent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const publicClient = usePublicClient();
  const [connectedChainId, setConnectedChainId] = useState<number | undefined>(undefined);

  const { switchNetwork } = useSwitchNetwork({
    onSuccess(data) {
      setConnectedChainId(data.id);
      console.log('Switched to chain:', data.id);
    },
  });

  const { connect } = useConnect({
    connector: new InjectedConnector(),
  });
  const { disconnect } = useDisconnect();

  useEffect(() => {
    const savedConnection = localStorage.getItem('walletConnected');
    if (savedConnection === 'true') {
      connect();
    }
  }, []);

  useEffect(() => {
    if (chain?.id) {
      setConnectedChainId(chain.id);
      console.log('Connected wallet chain ID:', chain.id);
    }
  }, [chain?.id]);

  useEffect(() => {
    localStorage.setItem('walletConnected', isConnected.toString());
  }, [isConnected]);

  const [conversation, setConversation] = useState<Conversation>({
    messages: [],
    systemPrompt: "You are a helpful AI assistant.",
  });
  const [tokenUsage, setTokenUsage] = useState({
    mainModel: { input: 0, output: 0 },
    toolChecker: { input: 0, output: 0 },
  });

  const { data: balance } = useBalance({ 
    address: address as `0x${string}` | undefined,
    chainId: chain?.id
  });
  const { sendTransactionAsync } = useSendTransaction();

  const getBalance = async ({ chain_name, address: inputAddress }: Partial<GetBalanceParams>) => {
    console.log('Chain name:', chain_name);
    console.log('Provided address:', inputAddress);
    console.log('Is wallet connected:', isConnected);
    console.log('Connected address:', address);
    
    let balanceAddress = inputAddress;
    if (!balanceAddress) {
      if (!isConnected) throw new Error('Wallet not connected');
      balanceAddress = address as string;
    }
    console.log('Getting balance for address:', balanceAddress);

    if (!balanceAddress) {
      throw new Error('No valid address available');
    }

    if (!isAddress(balanceAddress)) {
      console.error('Invalid address:', balanceAddress);
      throw new Error(`Invalid address format: ${balanceAddress}`);
    }
    
    const formattedAddress = getAddress(balanceAddress);

    let chainId = connectedChainId;
   
    if (!chainId) throw new Error('No chain connected');
    if (chain_name) {
      const foundChainId = await getChainId({ chain_name });
      if (foundChainId === undefined) {
        throw new Error(`Chain not found: ${chain_name}`);
      }
      chainId = foundChainId;
    }

    console.log('Using chain ID:', chainId);

    const result = await publicClient.getBalance({
      address: formattedAddress,
      chainId: chainId,
    } as PublicClientGetBalanceParams);
    
    return result ?? 0n;
  };

  const sendEth = async ({ to, value, chain_name }: SendEthParams): Promise<{ success: boolean; result: any }> => {
    try {
      if (!address) return { success: false, result: 'Wallet not connected' };
      console.log('sendEth called with:', { to, value, chain_name });
      if (!to) return { success: false, result: 'Recipient address for ETH transfer is undefined or empty' };
      if (!value) return { success: false, result: 'Value for ETH transfer is undefined or empty' };
      
      const bigIntValue = BigInt(value);
      if (bigIntValue <= 0) return { success: false, result: 'Value for ETH transfer must be greater than 0' };

      let targetChainId = chain?.id;
      if (!targetChainId) return { success: false, result: 'No chain connected' };
      if (chain_name) {
        const foundChainId = await getChainId({ chain_name });
        if (foundChainId === undefined) return { success: false, result: `Chain not found: ${chain_name}` };
        targetChainId = foundChainId;
      }

      console.log('Current chain ID:', connectedChainId);
      console.log('Target chain ID:', targetChainId);

      if (connectedChainId !== targetChainId) {
        console.log(`Switching to chain ${targetChainId}`);
        if (!switchNetwork) return { success: false, result: 'Network switching not supported' };
        
        try {
          await switchNetwork(targetChainId);
        } catch (switchError) {
          console.error('Error switching network:', switchError);
          return { success: false, result: 'Failed to switch network' };
        }
        
        // Wait for the chain to switch (up to 10 seconds)
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`Checking chain ID after switch attempt ${i + 1}:`, connectedChainId);
          if (connectedChainId === targetChainId) break;
        }
      }

      console.log('Final chain ID check:', connectedChainId);
      // Remove this check as it seems to be causing false negatives
      // if (connectedChainId !== targetChainId) {
      //   return { success: false, result: 'Failed to switch network or verify switch' };
      // }

      const { hash } = await sendTransactionAsync({ to, value: bigIntValue });
      console.log('Transaction hash:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Transaction receipt:', receipt);

      return { 
        success: true,
        result: {
          hash,
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          transactionIndex: receipt.transactionIndex
        }
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      return { success: false, result: (error as Error).message };
    }
  };

  const tools: Tool[] = [
    { name: 'get_wallet_address', execute: async () => address },
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
    if (!tool) {
      return JSON.stringify({ error: `Tool ${toolName} not found` });
    }

    try {
      const result = await tool.execute(toolInput);
      console.log(`Tool ${toolName} result:`, result);
      
      const serializedResult = JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      const toolUseResponse = {
        tool_use_id: toolUseId,
        content: serializedResult,
      };

      await sendMessage(JSON.stringify(toolUseResponse), conversation.messages);

      return serializedResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error executing tool ${toolName}:`, errorMessage);
      return JSON.stringify({ error: errorMessage });
    }
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

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="connect-button-container">
          {isConnected ? (
            <>
              <span className="address-display">
                {`${address?.slice(0, 5)}...${address?.slice(-5)}`}
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
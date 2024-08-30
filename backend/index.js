require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    };

    console.log('Headers:', headers); // Debug log

    let formattedMessages = req.body.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    console.log('Received messages:', formattedMessages); // Debug log

    if (formattedMessages.length === 0) {
      formattedMessages.push({
        role: 'system',
        content: `You are an AI assistant with access to various tools. When a user asks for something that requires using a tool, 
        use that tool..
        }`
      });
    }

    console.log('Formatted messages:', formattedMessages); // Debug log

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-sonnet-20240229',
        messages: formattedMessages,
        max_tokens: 1000,
        tools: [
      {
          "name": "get_wallet_address",
          "description": "Get the address of the connected Ethereum wallet.",
          "input_schema": {
              "type": "object",
              "properties": {}
          }
      },
      {
          "name": "send_eth",
          "description": "Send Ethereum (ETH) from a stored wallet to a specified address.",
          "input_schema": {
              "type": "object",
              "properties": {
                  "to": {
                      "type": "string",
                      "description": "The Ethereum address to send to"
                  },
                  "value": {
                      "type": "number",
                      "description": "The amount of ETH to send"
                  },
                  "chain_id": {
                      "type": "number",
                      "description": "The EVM chain ID (optional)"
                  }
              },
              "required": ["to_address", "value"]
          }
      },
      {
          "name": "get_balance",
          "description": "Get the balance of an Ethereum address.",
          "input_schema": {
              "type": "object",
              "properties": {
                  "address": {
                      "type": "string",
                      "description": "The Ethereum address to check the balance"
                  },
                  "chain_id": {
                      "type": "number",
                      "description": "The EVM chain ID (optional)"
                  }
              },
              "required": ["address"]
          }
      },
      {
          "name": "get_chain_id",
          "description": "Get the EVM chain ID for a given blockchain network name.",
          "input_schema": {
              "type": "object",
              "properties": {
                  "chain_name": {
                      "type": "string",
                      "description": "The name of the blockchain network (e.g., 'ethereum', 'polygon', 'arbitrum')"
                  }
              },
              "required": ["chain_name"]
          }
      }                      
        ]
      },
      { headers }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error communicating with Anthropic API', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

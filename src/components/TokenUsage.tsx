import React from 'react';

interface TokenUsageProps {
  usage: {
    mainModel: { input: number; output: number };
    toolChecker: { input: number; output: number };
  };
}

export const TokenUsage: React.FC<TokenUsageProps> = ({ usage }) => {
  return (
    <div className="token-usage" style={{ fontSize: '0.8rem', marginTop: '20px' }}>
      <h2>Token Usage</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Model</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Input</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Output</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>Main Model</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{usage.mainModel.input}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{usage.mainModel.output}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>Tool Checker</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{usage.toolChecker.input}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{usage.toolChecker.output}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
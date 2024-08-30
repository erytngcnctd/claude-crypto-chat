export type Role = 'user' | 'assistant' | 'system';

export interface Message {
    role: Role;
    content: string;
}

export type Conversation = Message[];

// API response types
export interface Usage {
    input_tokens: number;
    output_tokens: number;
}

export interface AnthropicResponse {
    id: string;
    type: string;
    role: Role;
    content: string[];
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: Usage;
    toolCalls?: ToolCall[];
}

// Tool types
export interface ToolRequest {
    tool: string;
    input: Record<string, any>;
}

export type APIResponse = {
    type: string;
    data: any;
    tokenUsage?: {
        mainModel: { input: number; output: number };
        toolChecker: { input: number; output: number };
    };
};

// Token usage types
export interface ModelUsage {
    input: number;
    output: number;
}

export interface TokenUsage {
    mainModel: ModelUsage;
    toolChecker?: ModelUsage;
}

// Hook types
export interface AnthropicAPIHook {
    sendMessage: (message: string, conversation: Conversation) => Promise<APIResponse>;
    isLoading: boolean;
    error: string | null;
}

// Tool type
export interface Tool {
    name: string;
    execute: (input: any) => Promise<any>;
}

export interface ToolCall {
    tool: string;
    input: Record<string, any>;
}

export interface ToolExecutionError extends Error {
    message: string;
}
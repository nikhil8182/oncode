export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface Project {
  name: string;
  path: string;
}

export interface Conversation {
  id: string;
  title: string;
  projectPath: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface TerminalOutput {
  id: string;
  command: string;
  output: string;
  exitCode?: number;
  timestamp: number;
}

export interface SocketEvents {
  "chat:message": (data: { content: string; projectPath: string; conversationId?: string }) => void;
  "chat:stream": (data: { delta: string; messageId: string }) => void;
  "chat:stream-end": (data: { messageId: string }) => void;
  "chat:error": (data: { error: string }) => void;
  "tool:start": (data: ToolCall) => void;
  "tool:end": (data: ToolCall) => void;
  "terminal:output": (data: TerminalOutput) => void;
}

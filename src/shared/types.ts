export type MessageRole = "user" | "assistant" | "system";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface RecentTurn {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sessionId: string;
}

export interface MemoryContext {
  profile: string | null;
  relevantMemories: string[];
  relevantEntities: EntityWithRelationships[];
  recentHistory: RecentTurn[];        // L1 episodic: last N turns across sessions
  sessionSummaries: string[];         // Summaries of recent past sessions
}

export interface EntityWithRelationships {
  id: string;
  name: string;
  type: string;
  relationships: Array<{
    predicate: string;
    objectValue: string | null;
    confidence: number;
  }>;
}

export interface ExtractedEntities {
  entities: Array<{
    name: string;
    type: string;
    attributes?: Record<string, unknown>;
  }>;
  relationships: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
  }>;
}

export interface OllamaStatus {
  online: boolean;
  model: string;
}

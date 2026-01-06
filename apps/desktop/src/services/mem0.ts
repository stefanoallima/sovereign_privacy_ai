/**
 * mem0 Memory Service
 * Provides persistent memory management across conversations
 * API docs: https://docs.mem0.ai/
 */

export interface Memory {
  id: string;
  memory: string;
  hash: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MemorySearchResult {
  id: string;
  memory: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface AddMemoryOptions {
  messages: Array<{ role: string; content: string }>;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryOptions {
  query: string;
  user_id?: string;
  agent_id?: string;
  limit?: number;
}

export class Mem0Client {
  private apiKey: string;
  private baseUrl: string;
  private userId: string;

  constructor(apiKey: string, userId = "default-user") {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.mem0.ai/v1";
    this.userId = userId;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      // Try to get memories to validate the key
      const response = await fetch(`${this.baseUrl}/memories/?user_id=${this.userId}&limit=1`, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Add memories from a conversation
   * mem0 automatically extracts and deduplicates memories from the messages
   */
  async addMemories(options: AddMemoryOptions): Promise<Memory[]> {
    const response = await fetch(`${this.baseUrl}/memories/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify({
        messages: options.messages,
        user_id: options.user_id || this.userId,
        agent_id: options.agent_id,
        run_id: options.run_id,
        metadata: options.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Search for relevant memories based on a query
   */
  async searchMemories(options: SearchMemoryOptions): Promise<MemorySearchResult[]> {
    const response = await fetch(`${this.baseUrl}/memories/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: options.query,
        user_id: options.user_id || this.userId,
        agent_id: options.agent_id,
        limit: options.limit || 10,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Get all memories for a user
   */
  async getAllMemories(userId?: string): Promise<Memory[]> {
    const uid = userId || this.userId;
    const response = await fetch(`${this.baseUrl}/memories/?user_id=${uid}`, {
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: string): Promise<Memory | null> {
    const response = await fetch(`${this.baseUrl}/memories/${memoryId}/`, {
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/memories/${memoryId}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllMemories(userId?: string): Promise<void> {
    const uid = userId || this.userId;
    const response = await fetch(`${this.baseUrl}/memories/?user_id=${uid}`, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`mem0 API error: ${response.status} - ${error}`);
    }
  }
}

// Singleton instance
let clientInstance: Mem0Client | null = null;

export function getMem0Client(apiKey?: string, userId?: string): Mem0Client {
  if (!clientInstance) {
    clientInstance = new Mem0Client(apiKey || "", userId);
  } else {
    if (apiKey) {
      clientInstance.setApiKey(apiKey);
    }
    if (userId) {
      clientInstance.setUserId(userId);
    }
  }
  return clientInstance;
}

/**
 * Format memories as context for the LLM
 */
export function formatMemoriesAsContext(memories: MemorySearchResult[]): string {
  if (memories.length === 0) return "";

  const memoryLines = memories
    .map((m, i) => `${i + 1}. ${m.memory}`)
    .join("\n");

  return `Here are relevant memories about the user:\n\n${memoryLines}`;
}

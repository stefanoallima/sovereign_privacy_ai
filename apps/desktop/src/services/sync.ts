import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { db, dbOps, type SyncQueueItem } from "@/lib/db";
import type { Database } from "@/types/supabase";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ContextRow = Database["public"]["Tables"]["personal_contexts"]["Row"];
type PersonaRow = Database["public"]["Tables"]["personas"]["Row"];

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  errors: string[];
}

class SyncService {
  private isSyncing = false;
  private lastSyncAt: Date | null = null;

  async sync(userId: string): Promise<SyncResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, pushed: 0, pulled: 0, errors: ["Supabase not configured"] };
    }

    if (this.isSyncing) {
      return { success: false, pushed: 0, pulled: 0, errors: ["Sync already in progress"] };
    }

    this.isSyncing = true;
    await dbOps.updateSyncState({ isSyncing: true });

    const result: SyncResult = { success: true, pushed: 0, pulled: 0, errors: [] };

    try {
      // Push local changes first
      const pushResult = await this.pushPendingChanges(userId);
      result.pushed = pushResult.count;
      result.errors.push(...pushResult.errors);

      // Then pull remote changes
      const pullResult = await this.pullRemoteChanges(userId);
      result.pulled = pullResult.count;
      result.errors.push(...pullResult.errors);

      this.lastSyncAt = new Date();
      await dbOps.updateSyncState({
        lastSyncAt: this.lastSyncAt,
        isSyncing: false,
        lastError: result.errors.length > 0 ? result.errors[0] : undefined,
      });
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown sync error");
      await dbOps.updateSyncState({
        isSyncing: false,
        lastError: result.errors[0],
      });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async pushPendingChanges(userId: string): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    // Process each entity type
    const entityTypes: SyncQueueItem["entityType"][] = [
      "project",
      "context",
      "persona",
      "conversation",
      "message",
    ];

    for (const entityType of entityTypes) {
      const pendingItems = await dbOps.getPendingSync(entityType);

      for (const item of pendingItems) {
        try {
          await this.pushSingleItem(item, userId);
          await dbOps.markSynced(entityType, item.entityId);
          count++;
        } catch (error) {
          const errorMsg = `Failed to push ${entityType} ${item.entityId}: ${error instanceof Error ? error.message : "Unknown error"}`;
          errors.push(errorMsg);
          console.error(errorMsg);

          // Update retry count
          await db.syncQueue.update(item.id!, {
            retryCount: item.retryCount + 1,
            lastError: errorMsg,
          });
        }
      }
    }

    return { count, errors };
  }

  private async pushSingleItem(item: SyncQueueItem, userId: string): Promise<void> {
    const tableName = this.getTableName(item.entityType);

    switch (item.operation) {
      case "create":
      case "update": {
        const data = this.transformForSupabase(item.entityType, item.data, userId);
        const { error } = await supabase
          .from(tableName)
          .upsert(data, { onConflict: "client_id" });

        if (error) throw error;
        break;
      }

      case "delete": {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("client_id", item.entityId)
          .eq("user_id", userId);

        if (error) throw error;
        break;
      }
    }
  }

  private async pullRemoteChanges(userId: string): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    const since = this.lastSyncAt?.toISOString() || new Date(0).toISOString();

    try {
      // Pull each entity type
      const [convs, msgs, projs, ctxs, personas] = await Promise.all([
        this.pullConversations(userId, since),
        this.pullMessages(userId, since),
        this.pullProjects(userId, since),
        this.pullContexts(userId, since),
        this.pullPersonas(userId, since),
      ]);

      count = convs.length + msgs.length + projs.length + ctxs.length + personas.length;
    } catch (error) {
      errors.push(`Pull failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    return { count, errors };
  }

  private async pullConversations(userId: string, since: string): Promise<ConversationRow[]> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .gte("updated_at", since);

    if (error) throw error;

    for (const remote of data || []) {
      await this.mergeConversation(remote);
    }

    return data || [];
  }

  private async pullMessages(userId: string, since: string): Promise<MessageRow[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", since);

    if (error) throw error;

    for (const remote of data || []) {
      await this.mergeMessage(remote);
    }

    return data || [];
  }

  private async pullProjects(userId: string, since: string): Promise<ProjectRow[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .gte("updated_at", since);

    if (error) throw error;

    for (const remote of data || []) {
      await this.mergeProject(remote);
    }

    return data || [];
  }

  private async pullContexts(userId: string, since: string): Promise<ContextRow[]> {
    const { data, error } = await supabase
      .from("personal_contexts")
      .select("*")
      .eq("user_id", userId)
      .gte("updated_at", since);

    if (error) throw error;

    for (const remote of data || []) {
      await this.mergeContext(remote);
    }

    return data || [];
  }

  private async pullPersonas(userId: string, since: string): Promise<PersonaRow[]> {
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .eq("user_id", userId)
      .gte("updated_at", since);

    if (error) throw error;

    for (const remote of data || []) {
      await this.mergePersona(remote);
    }

    return data || [];
  }

  // Last-Write-Wins merge strategies
  private async mergeConversation(remote: ConversationRow): Promise<void> {
    const local = await db.conversations.where("clientId").equals(remote.client_id).first();
    const remoteUpdated = new Date(remote.updated_at);

    if (!local) {
      // New from remote - add locally
      await db.conversations.add({
        id: remote.id,
        clientId: remote.client_id,
        userId: remote.user_id,
        projectId: remote.project_id || undefined,
        personaId: remote.persona_id,
        modelId: remote.model_id,
        title: remote.title,
        activeContextIds: remote.active_context_ids,
        totalTokensUsed: remote.total_tokens_used,
        createdAt: new Date(remote.created_at),
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
        pendingSync: false,
        deleted: false,
      });
    } else if (remoteUpdated > local.updatedAt && !local.pendingSync) {
      // Remote is newer and no pending local changes - update local
      await db.conversations.update(local.id, {
        projectId: remote.project_id || undefined,
        personaId: remote.persona_id,
        modelId: remote.model_id,
        title: remote.title,
        activeContextIds: remote.active_context_ids,
        totalTokensUsed: remote.total_tokens_used,
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
      });
    }
    // If local has pending changes, keep local version (will push on next sync)
  }

  private async mergeMessage(remote: MessageRow): Promise<void> {
    const local = await db.messages.where("clientId").equals(remote.client_id).first();

    if (!local) {
      // Messages are immutable - just add if not exists
      await db.messages.add({
        id: remote.id,
        clientId: remote.client_id,
        userId: remote.user_id,
        conversationId: remote.conversation_id,
        role: remote.role,
        content: remote.content,
        audioPath: remote.audio_path || undefined,
        modelId: remote.model_id || undefined,
        personaId: remote.persona_id || undefined,
        inputTokens: remote.input_tokens || undefined,
        outputTokens: remote.output_tokens || undefined,
        latencyMs: remote.latency_ms || undefined,
        createdAt: new Date(remote.created_at),
        syncedAt: new Date(),
        pendingSync: false,
        deleted: false,
      });
    }
  }

  private async mergeProject(remote: ProjectRow): Promise<void> {
    const local = await db.projects.where("clientId").equals(remote.client_id).first();
    const remoteUpdated = new Date(remote.updated_at);

    if (!local) {
      await db.projects.add({
        id: remote.id,
        clientId: remote.client_id,
        userId: remote.user_id,
        name: remote.name,
        description: remote.description || "",
        color: remote.color,
        defaultPersonaId: remote.default_persona_id || undefined,
        defaultContextIds: remote.default_context_ids,
        createdAt: new Date(remote.created_at),
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
        pendingSync: false,
        deleted: false,
      });
    } else if (remoteUpdated > local.updatedAt && !local.pendingSync) {
      await db.projects.update(local.id, {
        name: remote.name,
        description: remote.description || "",
        color: remote.color,
        defaultPersonaId: remote.default_persona_id || undefined,
        defaultContextIds: remote.default_context_ids,
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
      });
    }
  }

  private async mergeContext(remote: ContextRow): Promise<void> {
    const local = await db.contexts.where("clientId").equals(remote.client_id).first();
    const remoteUpdated = new Date(remote.updated_at);

    if (!local) {
      await db.contexts.add({
        id: remote.id,
        clientId: remote.client_id,
        userId: remote.user_id,
        name: remote.name,
        content: remote.content,
        tokenCount: remote.token_count,
        isDefault: remote.is_default,
        createdAt: new Date(remote.created_at),
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
        pendingSync: false,
        deleted: false,
      });
    } else if (remoteUpdated > local.updatedAt && !local.pendingSync) {
      await db.contexts.update(local.id, {
        name: remote.name,
        content: remote.content,
        tokenCount: remote.token_count,
        isDefault: remote.is_default,
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
      });
    }
  }

  private async mergePersona(remote: PersonaRow): Promise<void> {
    const local = await db.personas.where("clientId").equals(remote.client_id).first();
    const remoteUpdated = new Date(remote.updated_at);

    if (!local) {
      await db.personas.add({
        id: remote.id,
        clientId: remote.client_id,
        userId: remote.user_id,
        name: remote.name,
        description: remote.description || "",
        icon: remote.icon,
        systemPrompt: remote.system_prompt,
        voiceId: remote.voice_id || "",
        preferredModelId: remote.preferred_model_id || undefined,
        knowledgeBaseIds: remote.knowledge_base_ids,
        temperature: remote.temperature,
        maxTokens: remote.max_tokens,
        isBuiltIn: false,
        createdAt: new Date(remote.created_at),
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
        pendingSync: false,
        deleted: false,
      });
    } else if (remoteUpdated > local.updatedAt && !local.pendingSync) {
      await db.personas.update(local.id, {
        name: remote.name,
        description: remote.description || "",
        icon: remote.icon,
        systemPrompt: remote.system_prompt,
        voiceId: remote.voice_id || "",
        preferredModelId: remote.preferred_model_id || undefined,
        knowledgeBaseIds: remote.knowledge_base_ids,
        temperature: remote.temperature,
        maxTokens: remote.max_tokens,
        updatedAt: remoteUpdated,
        syncedAt: new Date(),
      });
    }
  }

  // Helper methods
  private getTableName(entityType: SyncQueueItem["entityType"]): keyof Database["public"]["Tables"] {
    const mapping: Record<SyncQueueItem["entityType"], keyof Database["public"]["Tables"]> = {
      conversation: "conversations",
      message: "messages",
      project: "projects",
      context: "personal_contexts",
      persona: "personas",
    };
    return mapping[entityType];
  }

  private transformForSupabase(
    entityType: SyncQueueItem["entityType"],
    data: any,
    userId: string
  ): any {
    // Transform local camelCase to Supabase snake_case
    const base = {
      user_id: userId,
      client_id: data.clientId || data.id,
    };

    switch (entityType) {
      case "conversation":
        return {
          ...base,
          id: data.id,
          project_id: data.projectId || null,
          persona_id: data.personaId,
          model_id: data.modelId,
          title: data.title,
          active_context_ids: data.activeContextIds || [],
          total_tokens_used: data.totalTokensUsed || 0,
          created_at: data.createdAt?.toISOString?.() || new Date().toISOString(),
          updated_at: data.updatedAt?.toISOString?.() || new Date().toISOString(),
        };

      case "message":
        return {
          ...base,
          id: data.id,
          conversation_id: data.conversationId,
          role: data.role,
          content: data.content,
          audio_path: data.audioPath || null,
          model_id: data.modelId || null,
          persona_id: data.personaId || null,
          input_tokens: data.inputTokens || null,
          output_tokens: data.outputTokens || null,
          latency_ms: data.latencyMs || null,
          created_at: data.createdAt?.toISOString?.() || new Date().toISOString(),
        };

      case "project":
        return {
          ...base,
          id: data.id,
          name: data.name,
          description: data.description || null,
          color: data.color,
          default_persona_id: data.defaultPersonaId || null,
          default_context_ids: data.defaultContextIds || [],
          created_at: data.createdAt?.toISOString?.() || new Date().toISOString(),
          updated_at: data.updatedAt?.toISOString?.() || new Date().toISOString(),
        };

      case "context":
        return {
          ...base,
          id: data.id,
          name: data.name,
          content: data.content,
          token_count: data.tokenCount || 0,
          is_default: data.isDefault || false,
          created_at: data.createdAt?.toISOString?.() || new Date().toISOString(),
          updated_at: data.updatedAt?.toISOString?.() || new Date().toISOString(),
        };

      case "persona":
        return {
          ...base,
          id: data.id,
          name: data.name,
          description: data.description || null,
          icon: data.icon || "🤖",
          system_prompt: data.systemPrompt,
          voice_id: data.voiceId || null,
          preferred_model_id: data.preferredModelId || null,
          knowledge_base_ids: data.knowledgeBaseIds || [],
          temperature: data.temperature ?? 0.7,
          max_tokens: data.maxTokens ?? 2000,
          created_at: data.createdAt?.toISOString?.() || new Date().toISOString(),
          updated_at: data.updatedAt?.toISOString?.() || new Date().toISOString(),
        };

      default:
        return base;
    }
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  getLastSyncAt(): Date | null {
    return this.lastSyncAt;
  }
}

// Export singleton instance
export const syncService = new SyncService();

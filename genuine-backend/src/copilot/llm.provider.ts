import { Injectable, Logger } from '@nestjs/common';

/**
 * Uliza LLM provider — OpenAI-compatible chat-completions API.
 * Server-side credentials only (ULIZA_LLM_BASE_URL / _API_KEY / _MODEL).
 * If unconfigured or failing, callers fall back to the rules engine —
 * core functionality never depends on the provider.
 */
import { TOOLS } from './tools';

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}
export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'auto' } };
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | LlmContentPart[] | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

@Injectable()
export class LlmProvider {
  private readonly logger = new Logger(LlmProvider.name);
  readonly configured: boolean;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs = 30_000;
  private readonly maxToolRounds = 4;

  constructor() {
    this.baseUrl = (process.env.ULIZA_LLM_BASE_URL || '').replace(/\/+$/, '');
    this.apiKey = process.env.ULIZA_LLM_API_KEY || '';
    this.model = process.env.ULIZA_LLM_MODEL || 'gpt-4o-mini';
    this.configured = Boolean(this.baseUrl && this.apiKey);
  }

  get providerName() {
    return this.configured ? `openai-compatible:${this.model}` : 'rules-engine';
  }

  /** One chat-completions round. Returns assistant message (may contain tool_calls). */
  async chat(messages: LlmMessage[], tools?: unknown[]): Promise<LlmMessage | null> {
    if (!this.configured) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools,
          tool_choice: tools ? 'auto' : undefined,
          temperature: 0.2,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`LLM HTTP ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) return null;
      return {
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
    } catch (e: any) {
      this.logger.warn(`LLM call failed: ${e?.message || e}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  toolSchemas() {
    return TOOLS.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
}

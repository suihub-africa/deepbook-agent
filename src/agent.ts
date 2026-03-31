/**
 * agent.ts
 *
 * Conversational AI agent with tool use (function calling).
 * Now completely configured to use Gemini.
 * Set GEMINI_API_KEY in your .env file.
 */

import type { SuiClient } from "./client.js";
import type { AgentState } from "./types.js";
import { TOOLS, type ToolName } from "./tools.js";
import { executeTool, type OnProgress } from "./tool_executor.js";

export type OnToken = (token: string) => void;
export type OnToolCall = (
  toolName: string,
  input: Record<string, unknown>,
) => void;
export type OnToolResult = (toolName: string, result: string) => void;

export interface AgentCallbacks {
  onToken: OnToken;
  onToolCall: OnToolCall;
  onToolResult: OnToolResult;
  onProgress: OnProgress;
}

const SYSTEM_PROMPT = `You are a DeepBook V3 trading agent on Sui testnet. You help users interact with the on-chain order book through natural conversation.

You have tools that execute real on-chain transactions. Use them when users want to take action. Always explain what you did and what the result means.

Key facts:
- DeepBook is a decentralized CLOB (central limit order book) on Sui
- Users need a BalanceManager before placing orders or depositing
- Caps (TradeCap, DepositCap, WithdrawCap) enable delegate operations
- Pools: DEEP_SUI, SUI_DBUSDC, DEEP_DBUSDC, DBUSDT_DBUSDC, WAL_DBUSDC, WAL_SUI, DBTC_DBUSDC
- Coins: DEEP, SUI, DBUSDC, DBUSDT, DBTC, WAL
- Swaps work directly from wallet — no BalanceManager needed
- Orders need: BalanceManager + funds deposited into it

When users ask what you can do, explain naturally. Be concise but clear. If something fails, explain why and suggest what to do next.`;

export class DeepBookAgent {
  private history: Array<{ role: string; content: any }> = [];

  constructor() {
    // Initialization no longer requires Anthropic checks
  }

  async chat(
    userMessage: string,
    client: SuiClient,
    state: AgentState,
    callbacks: AgentCallbacks,
  ): Promise<string> {
    this.history.push({ role: "user", content: userMessage });

    return this.chatGemini(userMessage, client, state, callbacks);
  }

  // ─── Gemini backend ────────────────────────────────────────────────────────

  private async chatGemini(
    userMessage: string,
    client: SuiClient,
    state: AgentState,
    callbacks: AgentCallbacks,
  ): Promise<string> {
    const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      const msg = "No AI key set. Add GEMINI_API_KEY to .env";
      callbacks.onToken(msg);
      return msg;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionDeclarations = TOOLS.map((t: any) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }));

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 30000);

        const res = await fetch(url, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: SYSTEM_PROMPT + "\n\nUser: " + userMessage }],
              },
            ],
            tools: [{ functionDeclarations }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
          }),
        });
        clearTimeout(timer);

        if (res.status === 404) continue;
        if (!res.ok) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await res.json()) as any;
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        let fullResponse = "";

        for (const part of parts) {
          if (part.text) {
            fullResponse += part.text;
            callbacks.onToken(part.text);
          }
          if (part.functionCall) {
            const { name, args } = part.functionCall;
            callbacks.onToolCall(name, args ?? {});
            const result = await executeTool(
              name as ToolName,
              args ?? {},
              client,
              state,
              callbacks.onProgress,
            );
            callbacks.onToolResult(name, result);
            const summary = `\n\n[${name}] ${result.split("\n")[0]}`;
            fullResponse += summary;
            callbacks.onToken(summary);
          }
        }

        return fullResponse;
      } catch (err) {
        if ((err as Error).message?.includes("fetch failed")) break;
        continue;
      }
    }

    const fallback = "Could not reach AI API. Check your API key in .env";
    callbacks.onToken(fallback);
    return fallback;
  }

  clearHistory(): void {
    this.history = [];
  }

  getBackend(): string {
    return "Gemini";
  }
}

import { POOLS, COINS } from "./constants.js";
import type { ParsedAction } from "./types.js";

const PK = Object.keys(POOLS).join("|");
const CK = Object.keys(COINS).join("|");
const NUM = "[\\d.]+";

// ─── Fast regex layer ─────────────────────────────────────────────────────────
export function fastParse(raw: string): ParsedAction | null {
  const s = raw.trim();
  const lower = s.toLowerCase();

  if (/^(exit|quit|q)$/i.test(s)) return { action: "exit" };
  if (/^(help|\?|commands?)$/i.test(s)) return { action: "help" };
  if (/^(status|stat|info|bal)$/i.test(s)) return { action: "status" };
  if (/^pools?$/i.test(s)) return { action: "pools" };
  if (/^coins?$/i.test(s)) return { action: "coins" };
  if (/^caps?$/i.test(s)) return { action: "caps" };
  if (/^create\s+(manager|balance\s*manager)$/i.test(s))
    return { action: "create_manager" };
  if (/^register\s+manager$/i.test(s)) return { action: "register_manager" };

  // ── Conversational / question patterns → help ──────────────────────────────
  // "what can i do", "what is this", "how does this work", etc.
  if (
    /^(what|how|who|where|which|show me|tell me|list|explain)/i.test(s) ||
    /\b(can i do|can you do|do you do|does this do|capabilities|features|available|commands|options)\b/i.test(
      s,
    ) ||
    /^(i don'?t know|not sure|confused|lost|stuck|help me)/i.test(lower) ||
    /\b(what.*agent|agent.*what|what.*this)\b/i.test(lower)
  ) {
    return { action: "help" };
  }

  const histM = s.match(/^history\s*(\d+)?$/i);
  if (histM) return { action: "history", n: parseInt(histM[1] ?? "10") };

  // ── Caps ─────────────────────────────────────────────────────────────────
  const mintTradeM = s.match(/^mint\s+trade\s*cap(?:\s+to\s+(\S+))?$/i);
  if (mintTradeM) return { action: "mint_trade_cap", recipient: mintTradeM[1] };

  const mintDepM = s.match(/^mint\s+deposit\s*cap(?:\s+to\s+(\S+))?$/i);
  if (mintDepM) return { action: "mint_deposit_cap", recipient: mintDepM[1] };

  const mintWdM = s.match(/^mint\s+withdraw\s*cap(?:\s+to\s+(\S+))?$/i);
  if (mintWdM) return { action: "mint_withdraw_cap", recipient: mintWdM[1] };

  const revokeM = s.match(/^revoke\s+trade\s*cap\s+(\S+)$/i);
  if (revokeM) return { action: "revoke_trade_cap", capId: revokeM[1] };

  const setTradeM = s.match(/^set\s+trade\s*cap\s+(\S+)$/i);
  if (setTradeM) return { action: "set_trade_cap", capId: setTradeM[1] };

  const setDepM = s.match(/^set\s+deposit\s*cap\s+(\S+)$/i);
  if (setDepM) return { action: "set_deposit_cap", capId: setDepM[1] };

  const setWdM = s.match(/^set\s+withdraw\s*cap\s+(\S+)$/i);
  if (setWdM) return { action: "set_withdraw_cap", capId: setWdM[1] };

  // ── Deposits ──────────────────────────────────────────────────────────────
  const depM = s.match(new RegExp(`^deposit\\s+(${CK})\\s+(${NUM})$`, "i"));
  if (depM)
    return {
      action: "deposit",
      coin: depM[1].toUpperCase(),
      amount: parseFloat(depM[2]),
    };

  const depCapM = s.match(
    new RegExp(`^deposit\\s+with\\s+cap\\s+(${CK})\\s+(${NUM})$`, "i"),
  );
  if (depCapM)
    return {
      action: "deposit_with_cap",
      coin: depCapM[1].toUpperCase(),
      amount: parseFloat(depCapM[2]),
    };

  // ── Withdrawals ───────────────────────────────────────────────────────────
  const wdM = s.match(new RegExp(`^withdraw\\s+(${CK})\\s+(${NUM})$`, "i"));
  if (wdM)
    return {
      action: "withdraw",
      coin: wdM[1].toUpperCase(),
      amount: parseFloat(wdM[2]),
    };

  const wdAllM = s.match(new RegExp(`^withdraw\\s+all\\s+(${CK})$`, "i"));
  if (wdAllM) return { action: "withdraw_all", coin: wdAllM[1].toUpperCase() };

  const wdCapM = s.match(
    new RegExp(`^withdraw\\s+with\\s+cap\\s+(${CK})\\s+(${NUM})$`, "i"),
  );
  if (wdCapM)
    return {
      action: "withdraw_with_cap",
      coin: wdCapM[1].toUpperCase(),
      amount: parseFloat(wdCapM[2]),
    };

  const wsM = s.match(new RegExp(`^withdraw\\s+settled\\s+(${PK})$`, "i"));
  if (wsM) return { action: "withdraw_settled", pool: wsM[1].toUpperCase() };

  // ── Orders ────────────────────────────────────────────────────────────────
  const limM = s.match(
    new RegExp(`^limit\\s+(${PK})\\s+(bid|ask)\\s+(${NUM})\\s+(${NUM})$`, "i"),
  );
  if (limM)
    return {
      action: "limit_order",
      pool: limM[1].toUpperCase(),
      side: limM[2].toLowerCase() as "bid" | "ask",
      price: parseFloat(limM[3]),
      qty: parseFloat(limM[4]),
    };

  const mktM = s.match(
    new RegExp(`^market\\s+(${PK})\\s+(bid|ask)\\s+(${NUM})$`, "i"),
  );
  if (mktM)
    return {
      action: "market_order",
      pool: mktM[1].toUpperCase(),
      side: mktM[2].toLowerCase() as "bid" | "ask",
      qty: parseFloat(mktM[3]),
    };

  const modM = s.match(
    new RegExp(`^modify\\s+(${PK})\\s+(\\S+)\\s+(${NUM})$`, "i"),
  );
  if (modM)
    return {
      action: "modify_order",
      pool: modM[1].toUpperCase(),
      orderId: modM[2],
      newQty: parseFloat(modM[3]),
    };

  const canOneM = s.match(
    new RegExp(`^cancel\\s+(${PK})\\s+(0x[\\da-fA-F]+|\\d+)$`, "i"),
  );
  if (canOneM)
    return {
      action: "cancel_order",
      pool: canOneM[1].toUpperCase(),
      orderId: canOneM[2],
    };

  const canAllM = s.match(new RegExp(`^cancel\\s+all\\s+(${PK})$`, "i"));
  if (canAllM) return { action: "cancel_all", pool: canAllM[1].toUpperCase() };

  const rebM = s.match(new RegExp(`^claim\\s+rebates?\\s+(${PK})$`, "i"));
  if (rebM) return { action: "claim_rebates", pool: rebM[1].toUpperCase() };

  // ── Swaps ─────────────────────────────────────────────────────────────────
  const swpM = s.match(
    new RegExp(
      `^swap\\s+(${PK})\\s+(${NUM})\\s+(${NUM})(?:\\s+(${NUM}))?$`,
      "i",
    ),
  );
  if (swpM)
    return {
      action: "swap_base_for_quote",
      pool: swpM[1].toUpperCase(),
      baseAmount: parseFloat(swpM[2]),
      deepAmount: parseFloat(swpM[3]),
      minOut: parseFloat(swpM[4] ?? "0"),
    };

  const rswpM = s.match(
    new RegExp(
      `^rswap\\s+(${PK})\\s+(${NUM})\\s+(${NUM})(?:\\s+(${NUM}))?$`,
      "i",
    ),
  );
  if (rswpM)
    return {
      action: "swap_quote_for_base",
      pool: rswpM[1].toUpperCase(),
      quoteAmount: parseFloat(rswpM[2]),
      deepAmount: parseFloat(rswpM[3]),
      minOut: parseFloat(rswpM[4] ?? "0"),
    };

  const mswpM = s.match(
    new RegExp(`^mswap\\s+(${PK})\\s+(${NUM})(?:\\s+(${NUM}))?$`, "i"),
  );
  if (mswpM)
    return {
      action: "swap_base_manager",
      pool: mswpM[1].toUpperCase(),
      baseAmount: parseFloat(mswpM[2]),
      minOut: parseFloat(mswpM[3] ?? "0"),
    };

  const mrswpM = s.match(
    new RegExp(`^mrswap\\s+(${PK})\\s+(${NUM})(?:\\s+(${NUM}))?$`, "i"),
  );
  if (mrswpM)
    return {
      action: "swap_quote_manager",
      pool: mrswpM[1].toUpperCase(),
      quoteAmount: parseFloat(mrswpM[2]),
      minOut: parseFloat(mrswpM[3] ?? "0"),
    };

  // ── Agent ─────────────────────────────────────────────────────────────────
  const runM = s.match(/^run\s+(?:agent\s*)?(\d+)?$/i);
  if (runM) return { action: "run_agent", cycles: parseInt(runM[1] ?? "1") };

  return null;
}

// ─── Gemini NL layer ──────────────────────────────────────────────────────────
// Current models from https://ai.google.dev/gemini-api/docs/models
// Primary: gemini-2.5-flash (best price/performance with thinking)
// Fallback: gemini-2.5-flash-lite (fastest, cheapest)
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const NL_SYSTEM = `You are a command parser for a DeepBook V3 trading terminal on Sui testnet.
Convert the user's natural language into ONE of these JSON objects.
Return ONLY raw JSON — no markdown, no explanation.

Actions:
{ "action": "limit_order",          "pool":"<P>", "side":"bid"|"ask", "price":<n>, "qty":<n> }
{ "action": "market_order",         "pool":"<P>", "side":"bid"|"ask", "qty":<n> }
{ "action": "modify_order",         "pool":"<P>", "orderId":"<id>", "newQty":<n> }
{ "action": "cancel_order",         "pool":"<P>", "orderId":"<id>" }
{ "action": "cancel_all",           "pool":"<P>" }
{ "action": "swap_base_for_quote",  "pool":"<P>", "baseAmount":<n>, "deepAmount":<n>, "minOut":<n> }
{ "action": "swap_quote_for_base",  "pool":"<P>", "quoteAmount":<n>, "deepAmount":<n>, "minOut":<n> }
{ "action": "swap_base_manager",    "pool":"<P>", "baseAmount":<n>, "minOut":<n> }
{ "action": "swap_quote_manager",   "pool":"<P>", "quoteAmount":<n>, "minOut":<n> }
{ "action": "deposit",              "coin":"<C>", "amount":<n> }
{ "action": "deposit_with_cap",     "coin":"<C>", "amount":<n> }
{ "action": "withdraw",             "coin":"<C>", "amount":<n> }
{ "action": "withdraw_all",         "coin":"<C>" }
{ "action": "withdraw_with_cap",    "coin":"<C>", "amount":<n> }
{ "action": "withdraw_settled",     "pool":"<P>" }
{ "action": "claim_rebates",        "pool":"<P>" }
{ "action": "mint_trade_cap" }
{ "action": "mint_deposit_cap" }
{ "action": "mint_withdraw_cap" }
{ "action": "revoke_trade_cap",     "capId":"<id>" }
{ "action": "create_manager" }
{ "action": "register_manager" }
{ "action": "run_agent",            "cycles":<n> }
{ "action": "status" }
{ "action": "caps" }
{ "action": "help" }
{ "action": "unknown", "reason":"<why>" }

Pools: DEEP_SUI, SUI_DBUSDC, DEEP_DBUSDC, DBUSDT_DBUSDC, WAL_DBUSDC, WAL_SUI, DBTC_DBUSDC
Coins: DEEP, SUI, DBUSDC, DBUSDT, DBTC, WAL
Default deepAmount=1, minOut=0.`;

export async function nlParse(userInput: string): Promise<ParsedAction> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { action: "unknown", reason: "GEMINI_API_KEY not set" };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: NL_SYSTEM }] },
            { role: "model", parts: [{ text: '{"action":"status"}' }] },
            { role: "user", parts: [{ text: userInput }] },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      });
      clearTimeout(timeout);

      if (res.status === 404) continue; // try next model
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(
        text.replace(/```json|```/gi, "").trim(),
      ) as ParsedAction;
      return parsed;
    } catch (err) {
      if ((err as Error).name === "AbortError") continue; // timeout, try next
      if (
        (err as Error).message?.includes("fetch failed") ||
        (err as Error).message?.includes("getaddrinfo")
      ) {
        // Network unreachable — return friendly unknown immediately
        return {
          action: "unknown",
          reason: "Gemini unreachable — use exact commands (type 'help')",
        };
      }
      // For other errors keep trying next model
      continue;
    }
  }

  return {
    action: "unknown",
    reason: "Could not reach Gemini API — use exact commands (type 'help')",
  };
}

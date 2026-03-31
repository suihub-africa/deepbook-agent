/**
 * tools.ts
 *
 * Tool definitions for the AI agent.
 * Each tool maps 1:1 to a DeepBook contract action.
 * The AI calls these tools when it decides to take an on-chain action.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type ToolName =
  | "create_balance_manager"
  | "register_manager"
  | "mint_trade_cap"
  | "mint_deposit_cap"
  | "mint_withdraw_cap"
  | "revoke_trade_cap"
  | "deposit"
  | "deposit_with_cap"
  | "withdraw"
  | "withdraw_all"
  | "withdraw_with_cap"
  | "place_limit_order"
  | "place_market_order"
  | "modify_order"
  | "cancel_order"
  | "cancel_all_orders"
  | "withdraw_settled"
  | "claim_rebates"
  | "swap_base_for_quote"
  | "swap_quote_for_base"
  | "swap_base_manager"
  | "swap_quote_manager"
  | "get_status"
  | "get_pools"
  | "get_coins"
  | "get_caps"
  | "get_history";

export const TOOLS: Anthropic.Tool[] = [
  // ── Setup ──────────────────────────────────────────────────────────────────
  {
    name: "create_balance_manager",
    description:
      "Create a new DeepBook BalanceManager on-chain. Required before placing orders or depositing. The caller becomes the owner.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "register_manager",
    description:
      "Register the BalanceManager with the global registry. Call once after creating.",
    input_schema: { type: "object", properties: {}, required: [] },
  },

  // ── Capability minting ─────────────────────────────────────────────────────
  {
    name: "mint_trade_cap",
    description:
      "Mint a TradeCap object that allows delegate trading (placing/cancelling orders) without owning the BalanceManager.",
    input_schema: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description:
            "Sui address to send the cap to. Defaults to own wallet.",
        },
      },
      required: [],
    },
  },
  {
    name: "mint_deposit_cap",
    description:
      "Mint a DepositCap that allows a delegate to deposit into the BalanceManager.",
    input_schema: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "Sui address. Defaults to own wallet.",
        },
      },
      required: [],
    },
  },
  {
    name: "mint_withdraw_cap",
    description:
      "Mint a WithdrawCap that allows a delegate to withdraw from the BalanceManager.",
    input_schema: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "Sui address. Defaults to own wallet.",
        },
      },
      required: [],
    },
  },
  {
    name: "revoke_trade_cap",
    description:
      "Permanently revoke (burn) a TradeCap on-chain by its object ID.",
    input_schema: {
      type: "object",
      properties: {
        cap_id: {
          type: "string",
          description: "The TradeCap object ID to revoke.",
        },
      },
      required: ["cap_id"],
    },
  },

  // ── Deposits & Withdrawals ─────────────────────────────────────────────────
  {
    name: "deposit",
    description:
      "Deposit coins into the BalanceManager (owner only). Must have a BalanceManager first. Available coins: DEEP, SUI, DBUSDC, DBUSDT, DBTC, WAL.",
    input_schema: {
      type: "object",
      properties: {
        coin: {
          type: "string",
          description: "Coin symbol: DEEP, SUI, DBUSDC, DBUSDT, DBTC, WAL",
        },
        amount: {
          type: "number",
          description: "Human-readable amount e.g. 5.0 for 5 SUI",
        },
      },
      required: ["coin", "amount"],
    },
  },
  {
    name: "deposit_with_cap",
    description:
      "Deposit using a DepositCap (delegate deposit). Requires depositCap to be set.",
    input_schema: {
      type: "object",
      properties: {
        coin: { type: "string" },
        amount: { type: "number" },
      },
      required: ["coin", "amount"],
    },
  },
  {
    name: "withdraw",
    description:
      "Withdraw a specific amount of coin from the BalanceManager to your wallet.",
    input_schema: {
      type: "object",
      properties: {
        coin: { type: "string", description: "Coin symbol" },
        amount: { type: "number", description: "Amount to withdraw" },
      },
      required: ["coin", "amount"],
    },
  },
  {
    name: "withdraw_all",
    description: "Withdraw all of a given coin from the BalanceManager.",
    input_schema: {
      type: "object",
      properties: {
        coin: { type: "string", description: "Coin symbol" },
      },
      required: ["coin"],
    },
  },
  {
    name: "withdraw_with_cap",
    description:
      "Withdraw using a WithdrawCap (delegate withdrawal). Requires withdrawCap to be set.",
    input_schema: {
      type: "object",
      properties: {
        coin: { type: "string" },
        amount: { type: "number" },
      },
      required: ["coin", "amount"],
    },
  },

  // ── Orders ─────────────────────────────────────────────────────────────────
  {
    name: "place_limit_order",
    description:
      "Place a limit order on a DeepBook pool. Requires BalanceManager with sufficient funds. Available pools: DEEP_SUI, SUI_DBUSDC, DEEP_DBUSDC, DBUSDT_DBUSDC, WAL_DBUSDC, WAL_SUI, DBTC_DBUSDC.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string", description: "Pool key e.g. SUI_DBUSDC" },
        side: {
          type: "string",
          enum: ["bid", "ask"],
          description: "bid=buy base, ask=sell base",
        },
        price: {
          type: "number",
          description: "Limit price in quote currency per base",
        },
        quantity: { type: "number", description: "Amount of base coin" },
        pay_with_deep: {
          type: "boolean",
          description: "Pay fees in DEEP (recommended). Default true.",
        },
      },
      required: ["pool", "side", "price", "quantity"],
    },
  },
  {
    name: "place_market_order",
    description:
      "Place a market order that fills immediately at the best available price.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        side: { type: "string", enum: ["bid", "ask"] },
        quantity: { type: "number", description: "Base coin amount" },
      },
      required: ["pool", "side", "quantity"],
    },
  },
  {
    name: "modify_order",
    description:
      "Reduce an existing limit order's quantity. Cannot increase — cancel and re-place for that.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        order_id: { type: "string", description: "Protocol order ID (u128)" },
        new_quantity: { type: "number", description: "New (smaller) quantity" },
      },
      required: ["pool", "order_id", "new_quantity"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel a single limit order by its protocol ID.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        order_id: { type: "string" },
      },
      required: ["pool", "order_id"],
    },
  },
  {
    name: "cancel_all_orders",
    description:
      "Cancel all open orders for the BalanceManager in a given pool.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
      },
      required: ["pool"],
    },
  },
  {
    name: "withdraw_settled",
    description:
      "Withdraw settled (filled) amounts from a pool back into the BalanceManager.",
    input_schema: {
      type: "object",
      properties: { pool: { type: "string" } },
      required: ["pool"],
    },
  },
  {
    name: "claim_rebates",
    description: "Claim maker rebates earned from providing liquidity.",
    input_schema: {
      type: "object",
      properties: { pool: { type: "string" } },
      required: ["pool"],
    },
  },

  // ── Swaps ──────────────────────────────────────────────────────────────────
  {
    name: "swap_base_for_quote",
    description:
      "Swap exact base coin for quote coin using wallet balance (no BalanceManager needed). E.g. sell SUI to get DBUSDC.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        base_amount: {
          type: "number",
          description: "Amount of base coin to sell",
        },
        deep_amount: {
          type: "number",
          description: "DEEP tokens for fees. Default 1.",
        },
        min_out: {
          type: "number",
          description: "Minimum quote to receive. Default 0.",
        },
      },
      required: ["pool", "base_amount"],
    },
  },
  {
    name: "swap_quote_for_base",
    description:
      "Swap exact quote coin for base coin using wallet balance. E.g. sell DBUSDC to get SUI.",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        quote_amount: {
          type: "number",
          description: "Amount of quote coin to sell",
        },
        deep_amount: {
          type: "number",
          description: "DEEP tokens for fees. Default 1.",
        },
        min_out: {
          type: "number",
          description: "Minimum base to receive. Default 0.",
        },
      },
      required: ["pool", "quote_amount"],
    },
  },
  {
    name: "swap_base_manager",
    description:
      "Swap base→quote through BalanceManager (requires all 3 caps: trade, deposit, withdraw).",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        base_amount: { type: "number" },
        min_out: { type: "number", description: "Default 0." },
      },
      required: ["pool", "base_amount"],
    },
  },
  {
    name: "swap_quote_manager",
    description:
      "Swap quote→base through BalanceManager (requires all 3 caps: trade, deposit, withdraw).",
    input_schema: {
      type: "object",
      properties: {
        pool: { type: "string" },
        quote_amount: { type: "number" },
        min_out: { type: "number", description: "Default 0." },
      },
      required: ["pool", "quote_amount"],
    },
  },

  // ── Read-only / info ───────────────────────────────────────────────────────
  {
    name: "get_status",
    description:
      "Get current wallet balance, BalanceManager ID, open orders, caps, and stats.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_pools",
    description:
      "List all available DeepBook V3 pools and their base/quote coins.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_coins",
    description:
      "List all supported coins with their addresses and decimal places.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_caps",
    description:
      "Show currently stored capability object IDs (tradeCap, depositCap, withdrawCap).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_history",
    description: "Show recent on-chain activity log.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of entries to show. Default 10.",
        },
      },
      required: [],
    },
  },
];

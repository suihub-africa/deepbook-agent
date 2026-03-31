// ─── Pool & Coin Types ────────────────────────────────────────────────────────

export interface CoinMeta {
  address: string;
  type: string;
  scalar: bigint;
}

export interface PoolMeta {
  address: string;
  baseCoin: string;
  quoteCoin: string;
}

// ─── State Types ──────────────────────────────────────────────────────────────

export interface OrderRecord {
  clientOrderId: string;
  price: number;
  qty: number;
  side: "bid" | "ask";
  ts: string;
  digest: string;
}

export interface CapStore {
  tradeCapId?: string;
  depositCapId?: string;
  withdrawCapId?: string;
}

export interface Stats {
  totalOrders: number;
  totalSwaps: number;
  totalCancels: number;
  totalDeposits: number;
}

export interface ActivityEntry {
  ts: string;
  action: string;
  [key: string]: unknown;
}

export interface AgentState {
  balanceManagerId: string | null;
  caps: CapStore;
  openOrders: Record<string, OrderRecord[]>;
  activityLog: ActivityEntry[];
  stats: Stats;
}

// ─── Parsed Action Types ──────────────────────────────────────────────────────

export type ParsedAction =
  | { action: "status" }
  | { action: "help" }
  | { action: "caps" }
  | { action: "exit" }
  | { action: "pools" }
  | { action: "coins" }
  | { action: "history"; n: number }
  | { action: "create_manager" }
  | { action: "register_manager" }
  | { action: "mint_trade_cap"; recipient?: string }
  | { action: "mint_deposit_cap"; recipient?: string }
  | { action: "mint_withdraw_cap"; recipient?: string }
  | { action: "revoke_trade_cap"; capId: string }
  | { action: "set_trade_cap"; capId: string }
  | { action: "set_deposit_cap"; capId: string }
  | { action: "set_withdraw_cap"; capId: string }
  | { action: "deposit"; coin: string; amount: number }
  | { action: "deposit_with_cap"; coin: string; amount: number }
  | { action: "withdraw"; coin: string; amount: number }
  | { action: "withdraw_all"; coin: string }
  | { action: "withdraw_with_cap"; coin: string; amount: number }
  | { action: "limit_order"; pool: string; side: "bid" | "ask"; price: number; qty: number }
  | { action: "market_order"; pool: string; side: "bid" | "ask"; qty: number }
  | { action: "modify_order"; pool: string; orderId: string; newQty: number }
  | { action: "cancel_order"; pool: string; orderId: string }
  | { action: "cancel_all"; pool: string }
  | { action: "withdraw_settled"; pool: string }
  | { action: "withdraw_settled_permissionless"; pool: string }
  | { action: "claim_rebates"; pool: string }
  | { action: "swap_base_for_quote"; pool: string; baseAmount: number; deepAmount: number; minOut: number }
  | { action: "swap_quote_for_base"; pool: string; quoteAmount: number; deepAmount: number; minOut: number }
  | { action: "swap_base_manager"; pool: string; baseAmount: number; minOut: number }
  | { action: "swap_quote_manager"; pool: string; quoteAmount: number; minOut: number }
  | { action: "run_agent"; cycles: number }
  | { action: "unknown"; reason?: string };

// ─── Order placement params ───────────────────────────────────────────────────

export interface LimitOrderParams {
  price: number;
  quantity: number;
  isBid: boolean;
  orderType?: number;
  payWithDeep?: boolean;
  expiration?: bigint;
  tradeCapId?: string;
}

export interface MarketOrderParams {
  quantity: number;
  isBid: boolean;
  payWithDeep?: boolean;
  tradeCapId?: string;
}

// ─── Agent decision types ─────────────────────────────────────────────────────

export type AgentActionDecision = {
  action: string;
  pool?: string;
  price?: number;
  qty?: number;
  side?: "bid" | "ask";
  baseAmount?: number;
  quoteAmount?: number;
  deepAmount?: number;
  minOut?: number;
  coin?: string;
  amount?: number;
  payWithDeep?: boolean;
};

import { readFileSync, writeFileSync, existsSync } from "fs";
import type { AgentState, OrderRecord, ActivityEntry } from "./types.js";

const STATE_FILE = "./agent-state.json";

const DEFAULT_STATE: AgentState = {
  balanceManagerId: null,
  caps: {},
  openOrders: {},
  activityLog: [],
  stats: { totalOrders: 0, totalSwaps: 0, totalCancels: 0, totalDeposits: 0 },
};

export function loadState(): AgentState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf8")) as AgentState;
    } catch {
      return { ...DEFAULT_STATE };
    }
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state: AgentState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function logActivity(
  state: AgentState,
  action: string,
  details: Record<string, unknown>,
): void {
  const entry: ActivityEntry = { ts: new Date().toISOString(), action, ...details };
  state.activityLog.push(entry);
  if (state.activityLog.length > 200) {
    state.activityLog = state.activityLog.slice(-200);
  }
}

export function recordOrder(
  state: AgentState,
  poolKey: string,
  order: OrderRecord,
): void {
  if (!state.openOrders[poolKey]) state.openOrders[poolKey] = [];
  state.openOrders[poolKey].push(order);
  state.stats.totalOrders++;
}

export function clearPoolOrders(state: AgentState, poolKey: string): void {
  state.openOrders[poolKey] = [];
}

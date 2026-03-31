/**
 * tool_executor.ts
 *
 * Receives tool call requests from the AI agent and executes
 * the corresponding DeepBook PTB, returning a string result
 * that gets sent back to the AI.
 */

import type { SuiClient } from "./client.js";
import type { AgentState } from "./types.js";
import type { ToolName } from "./tools.js";
import {
  buildCreateBalanceManager,
  buildRegisterManager,
  buildMintTradeCap,
  buildMintDepositCap,
  buildMintWithdrawCap,
  buildRevokeTradeCap,
  buildDeposit,
  buildDepositWithCap,
  buildWithdraw,
  buildWithdrawAll,
  buildWithdrawWithCap,
  buildPlaceLimitOrder,
  buildPlaceMarketOrder,
  buildModifyOrder,
  buildCancelOrder,
  buildCancelAllOrders,
  buildWithdrawSettled,
  buildSwapBaseForQuote,
  buildSwapQuoteForBase,
  buildSwapBaseForQuoteWithManager,
  buildSwapQuoteForBaseWithManager,
  buildClaimRebates,
} from "./deepbook.js";
import { POOLS, COINS } from "./constants.js";
import {
  saveState,
  logActivity,
  recordOrder,
  clearPoolOrders,
} from "./state.js";

// Callback to notify UI of progress
export type OnProgress = (message: string) => void;

export async function executeTool(
  toolName: ToolName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  client: SuiClient,
  state: AgentState,
  onProgress: OnProgress,
): Promise<string> {
  try {
    switch (toolName) {
      // ── Setup ──────────────────────────────────────────────────────────────
      case "create_balance_manager": {
        if (state.balanceManagerId) {
          return `BalanceManager already exists: ${state.balanceManagerId}`;
        }
        onProgress("Creating BalanceManager on-chain…");
        const result = await client.execute(buildCreateBalanceManager());
        const bm = client
          .getCreatedObjects(result)
          .find((o) => o.type.includes("balance_manager::BalanceManager"));
        if (!bm) return "Error: BalanceManager not found in created objects";
        state.balanceManagerId = bm.id;
        logActivity(state, "create_manager", { id: bm.id });
        saveState(state);
        return `BalanceManager created successfully.\nID: ${bm.id}\nTx: ${result.digest}`;
      }

      case "register_manager": {
        requireManager(state);
        onProgress("Registering BalanceManager…");
        const result = await client.execute(
          buildRegisterManager(state.balanceManagerId!),
        );
        logActivity(state, "register_manager", { digest: result.digest });
        saveState(state);
        return `BalanceManager registered with global registry.\nTx: ${result.digest}`;
      }

      // ── Caps ───────────────────────────────────────────────────────────────
      case "mint_trade_cap": {
        requireManager(state);
        const recipient = input.recipient ?? client.address;
        onProgress("Minting TradeCap…");
        const result = await client.execute(
          buildMintTradeCap(state.balanceManagerId!, recipient),
        );
        const cap = client
          .getCreatedObjects(result)
          .find(
            (o) =>
              o.type.toLowerCase().includes("tradecap") ||
              o.type.includes("trade_cap"),
          );
        const capId = cap?.id ?? "(check explorer)";
        if (recipient === client.address) state.caps.tradeCapId = capId;
        logActivity(state, "mint_trade_cap", { capId, recipient });
        saveState(state);
        return `TradeCap minted.\nID: ${capId}\nTx: ${result.digest}\n\nThis cap lets delegates place and cancel orders. It has been saved as your active tradeCap.`;
      }

      case "mint_deposit_cap": {
        requireManager(state);
        const recipient = input.recipient ?? client.address;
        onProgress("Minting DepositCap…");
        const result = await client.execute(
          buildMintDepositCap(state.balanceManagerId!, recipient),
        );
        const cap = client
          .getCreatedObjects(result)
          .find(
            (o) =>
              o.type.toLowerCase().includes("depositcap") ||
              o.type.includes("deposit_cap"),
          );
        const capId = cap?.id ?? "(check explorer)";
        if (recipient === client.address) state.caps.depositCapId = capId;
        logActivity(state, "mint_deposit_cap", { capId, recipient });
        saveState(state);
        return `DepositCap minted.\nID: ${capId}\nTx: ${result.digest}`;
      }

      case "mint_withdraw_cap": {
        requireManager(state);
        const recipient = input.recipient ?? client.address;
        onProgress("Minting WithdrawCap…");
        const result = await client.execute(
          buildMintWithdrawCap(state.balanceManagerId!, recipient),
        );
        const cap = client
          .getCreatedObjects(result)
          .find(
            (o) =>
              o.type.toLowerCase().includes("withdrawcap") ||
              o.type.includes("withdraw_cap"),
          );
        const capId = cap?.id ?? "(check explorer)";
        if (recipient === client.address) state.caps.withdrawCapId = capId;
        logActivity(state, "mint_withdraw_cap", { capId, recipient });
        saveState(state);
        return `WithdrawCap minted.\nID: ${capId}\nTx: ${result.digest}`;
      }

      case "revoke_trade_cap": {
        requireManager(state);
        onProgress(`Revoking TradeCap ${input.cap_id}…`);
        const result = await client.execute(
          buildRevokeTradeCap(state.balanceManagerId!, input.cap_id),
        );
        if (state.caps.tradeCapId === input.cap_id)
          delete state.caps.tradeCapId;
        logActivity(state, "revoke_trade_cap", { capId: input.cap_id });
        saveState(state);
        return `TradeCap revoked on-chain.\nTx: ${result.digest}`;
      }

      // ── Deposits ───────────────────────────────────────────────────────────
      case "deposit": {
        requireManager(state);
        if (!COINS[input.coin])
          return `Unknown coin: ${input.coin}. Available: ${Object.keys(COINS).join(", ")}`;
        onProgress(`Depositing ${input.amount} ${input.coin}…`);
        const result = await client.execute(
          buildDeposit(state.balanceManagerId!, input.coin, input.amount),
        );
        state.stats.totalDeposits++;
        logActivity(state, "deposit", {
          coin: input.coin,
          amount: input.amount,
        });
        saveState(state);
        return `Successfully deposited ${input.amount} ${input.coin} into BalanceManager.\nTx: ${result.digest}`;
      }

      case "deposit_with_cap": {
        requireManager(state);
        const depCap = state.caps.depositCapId;
        if (!depCap)
          return "No depositCap stored. Mint one first: mint deposit cap";
        if (!COINS[input.coin]) return `Unknown coin: ${input.coin}`;
        onProgress(`Depositing ${input.amount} ${input.coin} via DepositCap…`);
        const result = await client.execute(
          buildDepositWithCap(
            state.balanceManagerId!,
            depCap,
            input.coin,
            input.amount,
          ),
        );
        state.stats.totalDeposits++;
        logActivity(state, "deposit_with_cap", {
          coin: input.coin,
          amount: input.amount,
        });
        saveState(state);
        return `Deposited ${input.amount} ${input.coin} using DepositCap.\nTx: ${result.digest}`;
      }

      // ── Withdrawals ────────────────────────────────────────────────────────
      case "withdraw": {
        requireManager(state);
        if (!COINS[input.coin]) return `Unknown coin: ${input.coin}`;
        onProgress(`Withdrawing ${input.amount} ${input.coin}…`);
        const result = await client.execute(
          buildWithdraw(
            state.balanceManagerId!,
            input.coin,
            input.amount,
            client.address,
          ),
        );
        logActivity(state, "withdraw", {
          coin: input.coin,
          amount: input.amount,
        });
        saveState(state);
        return `Withdrew ${input.amount} ${input.coin} to your wallet.\nTx: ${result.digest}`;
      }

      case "withdraw_all": {
        requireManager(state);
        if (!COINS[input.coin]) return `Unknown coin: ${input.coin}`;
        onProgress(`Withdrawing all ${input.coin}…`);
        const result = await client.execute(
          buildWithdrawAll(state.balanceManagerId!, input.coin, client.address),
        );
        logActivity(state, "withdraw_all", { coin: input.coin });
        saveState(state);
        return `Withdrew all ${input.coin} to your wallet.\nTx: ${result.digest}`;
      }

      case "withdraw_with_cap": {
        requireManager(state);
        const wdCap = state.caps.withdrawCapId;
        if (!wdCap)
          return "No withdrawCap stored. Mint one first: mint withdraw cap";
        if (!COINS[input.coin]) return `Unknown coin: ${input.coin}`;
        onProgress(
          `Withdrawing ${input.amount} ${input.coin} via WithdrawCap…`,
        );
        const result = await client.execute(
          buildWithdrawWithCap(
            state.balanceManagerId!,
            wdCap,
            input.coin,
            input.amount,
            client.address,
          ),
        );
        logActivity(state, "withdraw_with_cap", {
          coin: input.coin,
          amount: input.amount,
        });
        saveState(state);
        return `Withdrew ${input.amount} ${input.coin} using WithdrawCap.\nTx: ${result.digest}`;
      }

      // ── Orders ─────────────────────────────────────────────────────────────
      case "place_limit_order": {
        requireManager(state);
        if (!POOLS[input.pool])
          return `Unknown pool: ${input.pool}. Available: ${Object.keys(POOLS).join(", ")}`;
        onProgress(
          `Placing ${input.side.toUpperCase()} limit ${input.quantity} @ ${input.price} on ${input.pool}…`,
        );
        const { tx, clientOrderId } = buildPlaceLimitOrder(
          input.pool,
          state.balanceManagerId!,
          {
            price: input.price,
            quantity: input.quantity,
            isBid: input.side === "bid",
            payWithDeep: input.pay_with_deep ?? true,
            tradeCapId: state.caps.tradeCapId,
          },
        );
        const result = await client.execute(tx);
        const p = POOLS[input.pool];
        recordOrder(state, input.pool, {
          clientOrderId: clientOrderId.toString(),
          price: input.price,
          qty: input.quantity,
          side: input.side,
          ts: new Date().toISOString(),
          digest: result.digest,
        });
        logActivity(state, "limit_order", {
          pool: input.pool,
          side: input.side,
          price: input.price,
          qty: input.quantity,
        });
        saveState(state);
        return `${input.side.toUpperCase()} limit order placed on ${input.pool}.\nPool: ${p.baseCoin}/${p.quoteCoin}\nSide: ${input.side} | Price: ${input.price} | Qty: ${input.quantity}\nClient order ID: ${clientOrderId}\nTx: ${result.digest}`;
      }

      case "place_market_order": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(
          `Market ${input.side.toUpperCase()} ${input.quantity} on ${input.pool}…`,
        );
        const { tx } = buildPlaceMarketOrder(
          input.pool,
          state.balanceManagerId!,
          {
            quantity: input.quantity,
            isBid: input.side === "bid",
            tradeCapId: state.caps.tradeCapId,
          },
        );
        const result = await client.execute(tx);
        state.stats.totalOrders++;
        logActivity(state, "market_order", {
          pool: input.pool,
          side: input.side,
          qty: input.quantity,
        });
        saveState(state);
        return `Market ${input.side.toUpperCase()} order executed on ${input.pool}.\nQty: ${input.quantity}\nTx: ${result.digest}`;
      }

      case "modify_order": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(`Modifying order ${input.order_id}…`);
        const tx = buildModifyOrder(
          input.pool,
          state.balanceManagerId!,
          input.order_id,
          input.new_quantity,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        logActivity(state, "modify_order", {
          pool: input.pool,
          orderId: input.order_id,
          newQty: input.new_quantity,
        });
        saveState(state);
        return `Order modified. New qty: ${input.new_quantity}\nTx: ${result.digest}`;
      }

      case "cancel_order": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(`Cancelling order ${input.order_id}…`);
        const tx = buildCancelOrder(
          input.pool,
          state.balanceManagerId!,
          input.order_id,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        state.stats.totalCancels++;
        logActivity(state, "cancel_order", {
          pool: input.pool,
          orderId: input.order_id,
        });
        saveState(state);
        return `Order ${input.order_id} cancelled.\nTx: ${result.digest}`;
      }

      case "cancel_all_orders": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(`Cancelling all orders on ${input.pool}…`);
        const tx = buildCancelAllOrders(
          input.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        clearPoolOrders(state, input.pool);
        state.stats.totalCancels++;
        logActivity(state, "cancel_all", { pool: input.pool });
        saveState(state);
        return `All orders cancelled on ${input.pool}.\nTx: ${result.digest}`;
      }

      case "withdraw_settled": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(`Withdrawing settled amounts from ${input.pool}…`);
        const tx = buildWithdrawSettled(
          input.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        logActivity(state, "withdraw_settled", { pool: input.pool });
        saveState(state);
        return `Settled amounts withdrawn from ${input.pool}.\nTx: ${result.digest}`;
      }

      case "claim_rebates": {
        requireManager(state);
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        onProgress(`Claiming rebates from ${input.pool}…`);
        const tx = buildClaimRebates(
          input.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        logActivity(state, "claim_rebates", { pool: input.pool });
        saveState(state);
        return `Rebates claimed from ${input.pool}.\nTx: ${result.digest}`;
      }

      // ── Swaps ──────────────────────────────────────────────────────────────
      case "swap_base_for_quote": {
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        const p = POOLS[input.pool];
        onProgress(
          `Swapping ${input.base_amount} ${p.baseCoin} → ${p.quoteCoin}…`,
        );
        const tx = buildSwapBaseForQuote(
          input.pool,
          input.base_amount,
          input.deep_amount ?? 1,
          input.min_out ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        state.stats.totalSwaps++;
        logActivity(state, "swap_b2q", {
          pool: input.pool,
          baseAmount: input.base_amount,
        });
        saveState(state);
        return `Swapped ${input.base_amount} ${p.baseCoin} → ${p.quoteCoin}.\nTx: ${result.digest}`;
      }

      case "swap_quote_for_base": {
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        const p = POOLS[input.pool];
        onProgress(
          `Swapping ${input.quote_amount} ${p.quoteCoin} → ${p.baseCoin}…`,
        );
        const tx = buildSwapQuoteForBase(
          input.pool,
          input.quote_amount,
          input.deep_amount ?? 1,
          input.min_out ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        state.stats.totalSwaps++;
        logActivity(state, "swap_q2b", {
          pool: input.pool,
          quoteAmount: input.quote_amount,
        });
        saveState(state);
        return `Swapped ${input.quote_amount} ${p.quoteCoin} → ${p.baseCoin}.\nTx: ${result.digest}`;
      }

      case "swap_base_manager": {
        requireManager(state);
        const { tradeCapId, depositCapId, withdrawCapId } = state.caps;
        if (!tradeCapId || !depositCapId || !withdrawCapId)
          return "Need all 3 caps (trade, deposit, withdraw). Mint them first.";
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        const p = POOLS[input.pool];
        onProgress(
          `Manager swap ${input.base_amount} ${p.baseCoin} → ${p.quoteCoin}…`,
        );
        const tx = buildSwapBaseForQuoteWithManager(
          input.pool,
          state.balanceManagerId!,
          tradeCapId,
          depositCapId,
          withdrawCapId,
          input.base_amount,
          input.min_out ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        state.stats.totalSwaps++;
        logActivity(state, "swap_base_manager", {
          pool: input.pool,
          baseAmount: input.base_amount,
        });
        saveState(state);
        return `Manager swap: ${input.base_amount} ${p.baseCoin} → ${p.quoteCoin}.\nTx: ${result.digest}`;
      }

      case "swap_quote_manager": {
        requireManager(state);
        const { tradeCapId, depositCapId, withdrawCapId } = state.caps;
        if (!tradeCapId || !depositCapId || !withdrawCapId)
          return "Need all 3 caps (trade, deposit, withdraw). Mint them first.";
        if (!POOLS[input.pool]) return `Unknown pool: ${input.pool}`;
        const p = POOLS[input.pool];
        onProgress(
          `Manager swap ${input.quote_amount} ${p.quoteCoin} → ${p.baseCoin}…`,
        );
        const tx = buildSwapQuoteForBaseWithManager(
          input.pool,
          state.balanceManagerId!,
          tradeCapId,
          depositCapId,
          withdrawCapId,
          input.quote_amount,
          input.min_out ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        state.stats.totalSwaps++;
        logActivity(state, "swap_quote_manager", {
          pool: input.pool,
          quoteAmount: input.quote_amount,
        });
        saveState(state);
        return `Manager swap: ${input.quote_amount} ${p.quoteCoin} → ${p.baseCoin}.\nTx: ${result.digest}`;
      }

      // ── Read-only ──────────────────────────────────────────────────────────
      case "get_status": {
        onProgress("Fetching wallet balance…");
        const bal = await client.getSuiBalance();
        const openOrdersSummary =
          Object.entries(state.openOrders)
            .filter(([, v]) => v.length > 0)
            .map(([pool, orders]) => `  ${pool}: ${orders.length} order(s)`)
            .join("\n") || "  None";

        return [
          `=== Wallet ===`,
          `Address: ${client.address}`,
          `SUI Balance: ${(Number(bal) / 1e9).toFixed(4)} SUI`,
          ``,
          `=== BalanceManager ===`,
          `ID: ${state.balanceManagerId ?? "Not created yet — use create_balance_manager"}`,
          ``,
          `=== Capabilities ===`,
          `TradeCap:    ${state.caps.tradeCapId ?? "not minted"}`,
          `DepositCap:  ${state.caps.depositCapId ?? "not minted"}`,
          `WithdrawCap: ${state.caps.withdrawCapId ?? "not minted"}`,
          ``,
          `=== Open Orders ===`,
          openOrdersSummary,
          ``,
          `=== Stats ===`,
          `Orders: ${state.stats.totalOrders} | Swaps: ${state.stats.totalSwaps} | Cancels: ${state.stats.totalCancels} | Deposits: ${state.stats.totalDeposits}`,
        ].join("\n");
      }

      case "get_pools": {
        const lines = Object.entries(POOLS).map(
          ([key, p]) =>
            `  ${key.padEnd(18)} base: ${p.baseCoin.padEnd(8)} quote: ${p.quoteCoin}`,
        );
        return `Available DeepBook V3 Pools:\n${lines.join("\n")}`;
      }

      case "get_coins": {
        const lines = Object.entries(COINS).map(
          ([key, c]) =>
            `  ${key.padEnd(8)} decimals: ${Math.log10(Number(c.scalar))}`,
        );
        return `Available Coins:\n${lines.join("\n")}`;
      }

      case "get_caps": {
        return [
          `=== Stored Capability Objects ===`,
          `TradeCap:    ${state.caps.tradeCapId ?? "not set"}`,
          `DepositCap:  ${state.caps.depositCapId ?? "not set"}`,
          `WithdrawCap: ${state.caps.withdrawCapId ?? "not set"}`,
        ].join("\n");
      }

      case "get_history": {
        const limit = input.limit ?? 10;
        const entries = state.activityLog.slice(-limit);
        if (!entries.length) return "No activity yet.";
        return entries
          .map(
            (e) =>
              `[${(e.ts as string).slice(11, 19)}] ${e.action} ${Object.entries(
                e,
              )
                .filter(([k]) => !["ts", "action"].includes(k))
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")}`,
          )
          .join("\n");
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    const abort = msg.match(/MoveAbort.*?(\d+)/);
    if (abort)
      return `Contract error (abort code ${abort[1]}): ${msg.slice(0, 200)}`;
    return `Error: ${msg.slice(0, 300)}`;
  }
}

function requireManager(state: AgentState): void {
  if (!state.balanceManagerId)
    throw new Error("No BalanceManager yet. Ask me to create one first.");
}

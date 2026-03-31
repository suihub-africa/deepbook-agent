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
  buildWithdrawSettledPermissionless,
  buildSwapBaseForQuote,
  buildSwapQuoteForBase,
  buildSwapBaseForQuoteWithManager,
  buildSwapQuoteForBaseWithManager,
  buildClaimRebates,
} from "./deepbook.js";
import { POOLS, COINS } from "./constants.js";
import {
  loadState,
  saveState,
  logActivity,
  recordOrder,
  clearPoolOrders,
} from "./state.js";
import {
  spin,
  printTx,
  printError,
  printWarn,
  printInfo,
  printStatus,
  printPools,
  printCoins,
  printHistory,
  printCycleHeader,
  printCycleFooter,
  printAI,
  printHelp,
  c,
} from "./ui.js";
import { getAgentDecision, buildMarketContext } from "./agent.js";
import type { SuiClient } from "./client.js";
import type { ParsedAction, AgentState } from "./types.js";

// ─── Main dispatch ────────────────────────────────────────────────────────────
export async function execute(
  client: SuiClient,
  action: ParsedAction,
  state: AgentState,
): Promise<void> {
  try {
    switch (action.action) {
      case "status": {
        const sp = spin("Fetching balance…");
        const bal = await client.getSuiBalance();
        sp.stop();
        printStatus(client.address, bal, state);
        break;
      }

      case "caps": {
        const caps = state.caps;
        console.log();
        console.log(`  ${c.label("Stored Capability Objects")}`);
        console.log(`  ${c.muted("─".repeat(56))}`);
        console.log(
          `  ${c.label("tradeCap    ")} ${caps.tradeCapId ? c.value(caps.tradeCapId) : c.muted("not set")}`,
        );
        console.log(
          `  ${c.label("depositCap  ")} ${caps.depositCapId ? c.value(caps.depositCapId) : c.muted("not set")}`,
        );
        console.log(
          `  ${c.label("withdrawCap ")} ${caps.withdrawCapId ? c.value(caps.withdrawCapId) : c.muted("not set")}`,
        );
        console.log();
        break;
      }

      case "create_manager": {
        if (state.balanceManagerId) {
          printWarn(`Manager already exists: ${state.balanceManagerId}`);
          break;
        }
        const sp = spin("Creating BalanceManager on-chain…");
        const result = await client.execute(buildCreateBalanceManager());
        sp.stop();
        const bm = client
          .getCreatedObjects(result)
          .find((o) => o.type.includes("balance_manager::BalanceManager"));
        if (!bm) throw new Error("BalanceManager not found in created objects");
        state.balanceManagerId = bm.id;
        logActivity(state, "create_manager", { id: bm.id });
        saveState(state);
        printTx("BalanceManager created", result.digest, bm.id);
        break;
      }

      case "register_manager": {
        requireManager(state);
        const sp = spin("Registering BalanceManager…");
        const result = await client.execute(
          buildRegisterManager(state.balanceManagerId!),
        );
        sp.stop();
        logActivity(state, "register_manager", { digest: result.digest });
        saveState(state);
        printTx("BalanceManager registered", result.digest);
        break;
      }

      case "mint_trade_cap": {
        requireManager(state);
        const recipient = action.recipient ?? client.address;
        const sp = spin("Minting TradeCap…");
        const result = await client.execute(
          buildMintTradeCap(state.balanceManagerId!, recipient),
        );
        sp.stop();
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
        printTx("TradeCap minted", result.digest, capId);
        printInfo("Auto-saved as active tradeCap.");
        break;
      }

      case "mint_deposit_cap": {
        requireManager(state);
        const recipient = action.recipient ?? client.address;
        const sp = spin("Minting DepositCap…");
        const result = await client.execute(
          buildMintDepositCap(state.balanceManagerId!, recipient),
        );
        sp.stop();
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
        printTx("DepositCap minted", result.digest, capId);
        break;
      }

      case "mint_withdraw_cap": {
        requireManager(state);
        const recipient = action.recipient ?? client.address;
        const sp = spin("Minting WithdrawCap…");
        const result = await client.execute(
          buildMintWithdrawCap(state.balanceManagerId!, recipient),
        );
        sp.stop();
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
        printTx("WithdrawCap minted", result.digest, capId);
        break;
      }

      case "revoke_trade_cap": {
        requireManager(state);
        const sp = spin(`Revoking TradeCap ${action.capId}…`);
        const result = await client.execute(
          buildRevokeTradeCap(state.balanceManagerId!, action.capId),
        );
        sp.stop();
        if (state.caps.tradeCapId === action.capId)
          delete state.caps.tradeCapId;
        logActivity(state, "revoke_trade_cap", { capId: action.capId });
        saveState(state);
        printTx("TradeCap revoked", result.digest);
        break;
      }

      case "set_trade_cap":
        state.caps.tradeCapId = action.capId;
        saveState(state);
        printInfo(`Active tradeCap → ${c.value(action.capId)}`);
        break;

      case "set_deposit_cap":
        state.caps.depositCapId = action.capId;
        saveState(state);
        printInfo(`Active depositCap → ${c.value(action.capId)}`);
        break;

      case "set_withdraw_cap":
        state.caps.withdrawCapId = action.capId;
        saveState(state);
        printInfo(`Active withdrawCap → ${c.value(action.capId)}`);
        break;

      case "deposit": {
        requireManager(state);
        if (!COINS[action.coin])
          return printError(`Unknown coin: ${action.coin}`);
        const sp = spin(`Depositing ${action.amount} ${action.coin}…`);
        const result = await client.execute(
          buildDeposit(state.balanceManagerId!, action.coin, action.amount),
        );
        sp.stop();
        state.stats.totalDeposits++;
        logActivity(state, "deposit", {
          coin: action.coin,
          amount: action.amount,
        });
        saveState(state);
        printTx(`Deposited ${action.amount} ${action.coin}`, result.digest);
        break;
      }

      case "deposit_with_cap": {
        requireManager(state);
        const depCapId = state.caps.depositCapId;
        if (!depCapId)
          return printError("No depositCap set. Run: mint deposit cap");
        if (!COINS[action.coin])
          return printError(`Unknown coin: ${action.coin}`);
        const sp = spin(
          `Depositing ${action.amount} ${action.coin} via DepositCap…`,
        );
        const result = await client.execute(
          buildDepositWithCap(
            state.balanceManagerId!,
            depCapId,
            action.coin,
            action.amount,
          ),
        );
        sp.stop();
        state.stats.totalDeposits++;
        logActivity(state, "deposit_with_cap", {
          coin: action.coin,
          amount: action.amount,
        });
        saveState(state);
        printTx(
          `Deposited ${action.amount} ${action.coin} (DepositCap)`,
          result.digest,
        );
        break;
      }

      case "withdraw": {
        requireManager(state);
        if (!COINS[action.coin])
          return printError(`Unknown coin: ${action.coin}`);
        const sp = spin(`Withdrawing ${action.amount} ${action.coin}…`);
        const result = await client.execute(
          buildWithdraw(
            state.balanceManagerId!,
            action.coin,
            action.amount,
            client.address,
          ),
        );
        sp.stop();
        logActivity(state, "withdraw", {
          coin: action.coin,
          amount: action.amount,
        });
        saveState(state);
        printTx(`Withdrew ${action.amount} ${action.coin}`, result.digest);
        break;
      }

      case "withdraw_all": {
        requireManager(state);
        if (!COINS[action.coin])
          return printError(`Unknown coin: ${action.coin}`);
        const sp = spin(`Withdrawing all ${action.coin}…`);
        const result = await client.execute(
          buildWithdrawAll(
            state.balanceManagerId!,
            action.coin,
            client.address,
          ),
        );
        sp.stop();
        logActivity(state, "withdraw_all", { coin: action.coin });
        saveState(state);
        printTx(`Withdrew all ${action.coin}`, result.digest);
        break;
      }

      case "withdraw_with_cap": {
        requireManager(state);
        const wdCapId = state.caps.withdrawCapId;
        if (!wdCapId)
          return printError("No withdrawCap set. Run: mint withdraw cap");
        if (!COINS[action.coin])
          return printError(`Unknown coin: ${action.coin}`);
        const sp = spin(
          `Withdrawing ${action.amount} ${action.coin} via WithdrawCap…`,
        );
        const result = await client.execute(
          buildWithdrawWithCap(
            state.balanceManagerId!,
            wdCapId,
            action.coin,
            action.amount,
            client.address,
          ),
        );
        sp.stop();
        logActivity(state, "withdraw_with_cap", {
          coin: action.coin,
          amount: action.amount,
        });
        saveState(state);
        printTx(
          `Withdrew ${action.amount} ${action.coin} (WithdrawCap)`,
          result.digest,
        );
        break;
      }

      case "limit_order": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(
          `Placing ${action.side.toUpperCase()} limit ${action.qty} @ ${action.price} on ${action.pool}…`,
        );
        const { tx, clientOrderId } = buildPlaceLimitOrder(
          action.pool,
          state.balanceManagerId!,
          {
            price: action.price,
            quantity: action.qty,
            isBid: action.side === "bid",
            tradeCapId: state.caps.tradeCapId,
          },
        );
        const result = await client.execute(tx);
        sp.stop();
        recordOrder(state, action.pool, {
          clientOrderId: clientOrderId.toString(),
          price: action.price,
          qty: action.qty,
          side: action.side,
          ts: new Date().toISOString(),
          digest: result.digest,
        });
        logActivity(state, "limit_order", {
          pool: action.pool,
          side: action.side,
          price: action.price,
          qty: action.qty,
        });
        saveState(state);
        const lbl =
          action.side === "bid"
            ? c.bid(`BID ${action.qty} @ ${action.price}`)
            : c.ask(`ASK ${action.qty} @ ${action.price}`);
        printTx(
          `Limit order  ${lbl}  ${c.pool(action.pool)}`,
          result.digest,
          state.caps.tradeCapId ? c.muted("(TradeCap)") : "",
        );
        break;
      }

      case "market_order": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(
          `Market ${action.side.toUpperCase()} ${action.qty} on ${action.pool}…`,
        );
        const { tx } = buildPlaceMarketOrder(
          action.pool,
          state.balanceManagerId!,
          {
            quantity: action.qty,
            isBid: action.side === "bid",
            tradeCapId: state.caps.tradeCapId,
          },
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalOrders++;
        logActivity(state, "market_order", {
          pool: action.pool,
          side: action.side,
          qty: action.qty,
        });
        saveState(state);
        const lbl =
          action.side === "bid"
            ? c.bid(`BID ${action.qty}`)
            : c.ask(`ASK ${action.qty}`);
        printTx(`Market order  ${lbl}  ${c.pool(action.pool)}`, result.digest);
        break;
      }

      case "modify_order": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(
          `Modifying order ${action.orderId} → qty ${action.newQty}…`,
        );
        const tx = buildModifyOrder(
          action.pool,
          state.balanceManagerId!,
          action.orderId,
          action.newQty,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        sp.stop();
        logActivity(state, "modify_order", {
          pool: action.pool,
          orderId: action.orderId,
          newQty: action.newQty,
        });
        saveState(state);
        printTx(
          `Order modified  ${c.pool(action.pool)}  qty→${action.newQty}`,
          result.digest,
        );
        break;
      }

      case "cancel_order": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(`Cancelling order ${action.orderId}…`);
        const tx = buildCancelOrder(
          action.pool,
          state.balanceManagerId!,
          action.orderId,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalCancels++;
        logActivity(state, "cancel_order", {
          pool: action.pool,
          orderId: action.orderId,
        });
        saveState(state);
        printTx(`Order cancelled  ${c.pool(action.pool)}`, result.digest);
        break;
      }

      case "cancel_all": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(`Cancelling all orders on ${action.pool}…`);
        const tx = buildCancelAllOrders(
          action.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        sp.stop();
        clearPoolOrders(state, action.pool);
        state.stats.totalCancels++;
        logActivity(state, "cancel_all", { pool: action.pool });
        saveState(state);
        printTx(`All orders cancelled  ${c.pool(action.pool)}`, result.digest);
        break;
      }

      case "withdraw_settled": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(`Withdrawing settled amounts from ${action.pool}…`);
        const tx = buildWithdrawSettled(
          action.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        sp.stop();
        logActivity(state, "withdraw_settled", { pool: action.pool });
        saveState(state);
        printTx(
          `Settled amounts withdrawn  ${c.pool(action.pool)}`,
          result.digest,
        );
        break;
      }

      case "claim_rebates": {
        requireManager(state);
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const sp = spin(`Claiming rebates from ${action.pool}…`);
        const tx = buildClaimRebates(
          action.pool,
          state.balanceManagerId!,
          state.caps.tradeCapId,
        );
        const result = await client.execute(tx);
        sp.stop();
        logActivity(state, "claim_rebates", { pool: action.pool });
        saveState(state);
        printTx(`Rebates claimed  ${c.pool(action.pool)}`, result.digest);
        break;
      }

      case "swap_base_for_quote": {
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const p = POOLS[action.pool];
        const sp = spin(
          `Swapping ${action.baseAmount} ${p.baseCoin} → ${p.quoteCoin}…`,
        );
        const tx = buildSwapBaseForQuote(
          action.pool,
          action.baseAmount,
          action.deepAmount ?? 1,
          action.minOut ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalSwaps++;
        logActivity(state, "swap_b2q", {
          pool: action.pool,
          baseAmount: action.baseAmount,
        });
        saveState(state);
        printTx(
          `Swap  ${c.swap(`${action.baseAmount} ${p.baseCoin}`)} → ${c.swap(p.quoteCoin)}  ${c.pool(action.pool)}`,
          result.digest,
        );
        break;
      }

      case "swap_quote_for_base": {
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const p = POOLS[action.pool];
        const sp = spin(
          `Swapping ${action.quoteAmount} ${p.quoteCoin} → ${p.baseCoin}…`,
        );
        const tx = buildSwapQuoteForBase(
          action.pool,
          action.quoteAmount,
          action.deepAmount ?? 1,
          action.minOut ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalSwaps++;
        logActivity(state, "swap_q2b", {
          pool: action.pool,
          quoteAmount: action.quoteAmount,
        });
        saveState(state);
        printTx(
          `Swap  ${c.swap(`${action.quoteAmount} ${p.quoteCoin}`)} → ${c.swap(p.baseCoin)}  ${c.pool(action.pool)}`,
          result.digest,
        );
        break;
      }

      case "swap_base_manager": {
        requireManager(state);
        const { tradeCapId, depositCapId, withdrawCapId } = state.caps;
        if (!tradeCapId || !depositCapId || !withdrawCapId)
          return printError(
            "Need all 3 caps. Run: mint trade cap, mint deposit cap, mint withdraw cap",
          );
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const p = POOLS[action.pool];
        const sp = spin(
          `Manager swap ${action.baseAmount} ${p.baseCoin} → ${p.quoteCoin}…`,
        );
        const tx = buildSwapBaseForQuoteWithManager(
          action.pool,
          state.balanceManagerId!,
          tradeCapId,
          depositCapId,
          withdrawCapId,
          action.baseAmount,
          action.minOut ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalSwaps++;
        logActivity(state, "swap_base_manager", {
          pool: action.pool,
          baseAmount: action.baseAmount,
        });
        saveState(state);
        printTx(
          `Manager swap  ${c.swap(`${action.baseAmount} ${p.baseCoin}`)} → ${c.swap(p.quoteCoin)}`,
          result.digest,
        );
        break;
      }

      case "swap_quote_manager": {
        requireManager(state);
        const { tradeCapId, depositCapId, withdrawCapId } = state.caps;
        if (!tradeCapId || !depositCapId || !withdrawCapId)
          return printError(
            "Need all 3 caps. Run: mint trade cap, mint deposit cap, mint withdraw cap",
          );
        if (!POOLS[action.pool])
          return printError(`Unknown pool: ${action.pool}`);
        const p = POOLS[action.pool];
        const sp = spin(
          `Manager swap ${action.quoteAmount} ${p.quoteCoin} → ${p.baseCoin}…`,
        );
        const tx = buildSwapQuoteForBaseWithManager(
          action.pool,
          state.balanceManagerId!,
          tradeCapId,
          depositCapId,
          withdrawCapId,
          action.quoteAmount,
          action.minOut ?? 0,
          client.address,
        );
        const result = await client.execute(tx);
        sp.stop();
        state.stats.totalSwaps++;
        logActivity(state, "swap_quote_manager", {
          pool: action.pool,
          quoteAmount: action.quoteAmount,
        });
        saveState(state);
        printTx(
          `Manager swap  ${c.swap(`${action.quoteAmount} ${p.quoteCoin}`)} → ${c.swap(p.baseCoin)}`,
          result.digest,
        );
        break;
      }

      case "pools":
        printPools();
        break;
      case "coins":
        printCoins();
        break;
      case "history":
        printHistory(state.activityLog, action.n ?? 10);
        break;

      case "run_agent": {
        const cycles = action.cycles ?? 1;
        for (let i = 1; i <= cycles; i++) {
          printCycleHeader(i);
          const totalOpen = Object.values(state.openOrders).reduce(
            (s, v) => s + v.length,
            0,
          );
          const sp = spin("Asking Gemini for next actions…");
          const actions = await getAgentDecision(
            state,
            buildMarketContext("SUI_DBUSDC", totalOpen),
          );
          sp.stop();
          printAI(`Planning ${actions.length} actions…`);
          for (const a of actions) {
            process.stdout.write(
              `  ${c.muted("→")} ${c.dim(JSON.stringify(a))}\n`,
            );
            try {
              await sleep(1800);
              await execute(client, a as ParsedAction, state);
            } catch (err) {
              printError(`${a.action}: ${(err as Error).message}`);
            }
          }
          printCycleFooter(state.stats);
          if (i < cycles) await sleep(3000);
        }
        break;
      }

      case "help":
        printHelp();
        break;

      case "exit":
        console.log(`\n  ${c.dim("Goodbye.")}\n`);
        process.exit(0);

      case "unknown":
        printError(
          action.reason
            ? `Could not understand: ${action.reason}`
            : "Unrecognised. Type 'help'.",
        );
        break;

      default:
        printError(`Unknown action: ${(action as ParsedAction).action}`);
    }
  } catch (err) {
    const msg = extractError(err);
    printError(msg);
    logActivity(state, "error", { action: action.action, error: msg });
    saveState(state);
  }
}

function requireManager(state: AgentState): void {
  if (!state.balanceManagerId)
    throw new Error("No BalanceManager. Run: create manager");
}

function extractError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  const abort = msg.match(/MoveAbort.*?(\d+)/);
  if (abort) return `Contract abort ${abort[1]}: ${msg.slice(0, 120)}`;
  return msg.slice(0, 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

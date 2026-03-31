/**
 * deepbook.ts
 *
 * Every DeepBook V3 contract interaction as raw PTBs.
 * Pure tx.moveCall() — zero DeepBook SDK dependency.
 */

import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import type { LimitOrderParams, MarketOrderParams } from "./types.js";
import {
  DEEPBOOK_PACKAGE_ID,
  REGISTRY_ID,
  CLOCK_ID,
  ORDER_TYPE,
  SELF_MATCHING,
  MAX_TIMESTAMP,
  getCoin,
  getPool,
  toBaseUnits,
  toInternalPrice,
  randomClientOrderId,
} from "./constants.js";

// ─── Internal: trade proof helpers ───────────────────────────────────────────

function proofAsOwner(tx: Transaction, managerAddress: string) {
  return tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::generate_proof_as_owner`,
    arguments: [tx.object(managerAddress)],
  });
}

function proofAsTrader(
  tx: Transaction,
  managerAddress: string,
  tradeCapId: string,
) {
  return tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::generate_proof_as_trader`,
    arguments: [tx.object(managerAddress), tx.object(tradeCapId)],
  });
}

function tradeProof(
  tx: Transaction,
  managerAddress: string,
  tradeCapId?: string,
) {
  return tradeCapId
    ? proofAsTrader(tx, managerAddress, tradeCapId)
    : proofAsOwner(tx, managerAddress);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE MANAGER — LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new shared BalanceManager on-chain.
 * Caller becomes the owner. Parse created object ID from result.
 */
export function buildCreateBalanceManager(): Transaction {
  const tx = new Transaction();
  const manager = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::new`,
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    arguments: [manager],
    typeArguments: [
      `${DEEPBOOK_PACKAGE_ID}::balance_manager::BalanceManager`,
    ],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

/**
 * Register BalanceManager with the global registry (call once after creation).
 */
export function buildRegisterManager(managerAddress: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::register_balance_manager`,
    arguments: [tx.object(managerAddress), tx.object(REGISTRY_ID)],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE MANAGER — CAPABILITY MINTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mint a TradeCap — delegate can place/cancel orders without owning the manager.
 */
export function buildMintTradeCap(
  managerAddress: string,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const cap = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::mint_trade_cap`,
    arguments: [tx.object(managerAddress)],
  });
  tx.transferObjects([cap], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

/**
 * Mint a DepositCap — delegate can deposit into the manager.
 */
export function buildMintDepositCap(
  managerAddress: string,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const cap = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::mint_deposit_cap`,
    arguments: [tx.object(managerAddress)],
  });
  tx.transferObjects([cap], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

/**
 * Mint a WithdrawCap — delegate can withdraw from the manager.
 */
export function buildMintWithdrawCap(
  managerAddress: string,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const cap = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::mint_withdraw_cap`,
    arguments: [tx.object(managerAddress)],
  });
  tx.transferObjects([cap], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

/**
 * Permanently revoke a TradeCap by its object ID.
 */
export function buildRevokeTradeCap(
  managerAddress: string,
  tradeCapId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::revoke_trade_cap`,
    arguments: [tx.object(managerAddress), tx.pure.id(tradeCapId)],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE MANAGER — DEPOSITS & WITHDRAWALS
// ═══════════════════════════════════════════════════════════════════════════════

/** Owner deposit into BalanceManager */
export function buildDeposit(
  managerAddress: string,
  coinKey: string,
  humanAmount: number,
): Transaction {
  const tx = new Transaction();
  const c = getCoin(coinKey);
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::deposit`,
    arguments: [
      tx.object(managerAddress),
      coinWithBalance({ type: c.type, balance: toBaseUnits(humanAmount, coinKey) }),
    ],
    typeArguments: [c.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Delegate deposit using a DepositCap */
export function buildDepositWithCap(
  managerAddress: string,
  depositCapId: string,
  coinKey: string,
  humanAmount: number,
): Transaction {
  const tx = new Transaction();
  const c = getCoin(coinKey);
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::deposit_with_cap`,
    arguments: [
      tx.object(managerAddress),
      tx.object(depositCapId),
      coinWithBalance({ type: c.type, balance: toBaseUnits(humanAmount, coinKey) }),
    ],
    typeArguments: [c.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Owner withdraw a specific amount from BalanceManager */
export function buildWithdraw(
  managerAddress: string,
  coinKey: string,
  humanAmount: number,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const c = getCoin(coinKey);
  const withdrawn = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::withdraw`,
    arguments: [
      tx.object(managerAddress),
      tx.pure.u64(toBaseUnits(humanAmount, coinKey)),
    ],
    typeArguments: [c.type],
  });
  tx.transferObjects([withdrawn], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Owner withdraw ALL of a coin from BalanceManager */
export function buildWithdrawAll(
  managerAddress: string,
  coinKey: string,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const c = getCoin(coinKey);
  const withdrawn = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::withdraw_all`,
    arguments: [tx.object(managerAddress)],
    typeArguments: [c.type],
  });
  tx.transferObjects([withdrawn], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Delegate withdraw using a WithdrawCap */
export function buildWithdrawWithCap(
  managerAddress: string,
  withdrawCapId: string,
  coinKey: string,
  humanAmount: number,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  const c = getCoin(coinKey);
  const withdrawn = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::withdraw_with_cap`,
    arguments: [
      tx.object(managerAddress),
      tx.object(withdrawCapId),
      tx.pure.u64(toBaseUnits(humanAmount, coinKey)),
    ],
    typeArguments: [c.type],
  });
  tx.transferObjects([withdrawn], recipient);
  tx.setGasBudget(50_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Place a limit order. Returns the transaction and the random clientOrderId. */
export function buildPlaceLimitOrder(
  poolKey: string,
  managerAddress: string,
  params: LimitOrderParams,
): { tx: Transaction; clientOrderId: bigint } {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);
  const clientOrderId = randomClientOrderId();
  const internalPrice = toInternalPrice(params.price, p.baseCoin, p.quoteCoin);
  const internalQty = toBaseUnits(params.quantity, p.baseCoin);
  const orderType = params.orderType ?? ORDER_TYPE.NO_RESTRICTION;
  const payWithDeep = params.payWithDeep ?? true;
  const expiration = params.expiration ?? MAX_TIMESTAMP;

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, params.tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::place_limit_order`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      proof,
      tx.pure.u64(clientOrderId),
      tx.pure.u8(orderType),
      tx.pure.u8(SELF_MATCHING.ALLOWED),
      tx.pure.u64(internalPrice),
      tx.pure.u64(internalQty),
      tx.pure.bool(params.isBid),
      tx.pure.bool(payWithDeep),
      tx.pure.u64(expiration),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(100_000_000);
  return { tx, clientOrderId };
}

/** Place a market order — fills at best available price. */
export function buildPlaceMarketOrder(
  poolKey: string,
  managerAddress: string,
  params: MarketOrderParams,
): { tx: Transaction; clientOrderId: bigint } {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);
  const clientOrderId = randomClientOrderId();
  const internalQty = toBaseUnits(params.quantity, p.baseCoin);
  const payWithDeep = params.payWithDeep ?? true;

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, params.tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::place_market_order`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      proof,
      tx.pure.u64(clientOrderId),
      tx.pure.u8(SELF_MATCHING.ALLOWED),
      tx.pure.u64(internalQty),
      tx.pure.bool(params.isBid),
      tx.pure.bool(payWithDeep),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(100_000_000);
  return { tx, clientOrderId };
}

/** Modify existing limit order quantity (can only reduce, not increase). */
export function buildModifyOrder(
  poolKey: string,
  managerAddress: string,
  orderId: string,
  newHumanQty: number,
  tradeCapId?: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::modify_order`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      proof,
      tx.pure.u128(BigInt(orderId)),
      tx.pure.u64(toBaseUnits(newHumanQty, p.baseCoin)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(100_000_000);
  return tx;
}

/** Cancel a single order by protocol u128 order ID. */
export function buildCancelOrder(
  poolKey: string,
  managerAddress: string,
  orderId: string,
  tradeCapId?: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::cancel_order`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      proof,
      tx.pure.u128(BigInt(orderId)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(100_000_000);
  return tx;
}

/** Cancel ALL open orders for this manager in a pool. */
export function buildCancelAllOrders(
  poolKey: string,
  managerAddress: string,
  tradeCapId?: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::cancel_all_orders`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      proof,
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(200_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTLED AMOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Withdraw settled (filled) amounts back into the BalanceManager. */
export function buildWithdrawSettled(
  poolKey: string,
  managerAddress: string,
  tradeCapId?: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, tradeCapId);

  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::withdraw_settled_amounts`,
    arguments: [tx.object(p.address), tx.object(managerAddress), proof],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Withdraw settled amounts permissionlessly — anyone can call for any manager. */
export function buildWithdrawSettledPermissionless(
  poolKey: string,
  managerAddress: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::withdraw_settled_amounts_permissionless`,
    arguments: [tx.object(p.address), tx.object(managerAddress)],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWAPS — WALLET-NATIVE (no BalanceManager)
// ═══════════════════════════════════════════════════════════════════════════════

/** Swap exact base → quote (e.g. sell SUI → DBUSDC). Coins from wallet. */
export function buildSwapBaseForQuote(
  poolKey: string,
  baseAmount: number,
  deepAmount: number,
  minQuoteOut: number,
  recipient: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);
  const deep = getCoin("DEEP");

  const tx = new Transaction();
  const [baseOut, quoteOut, deepOut] = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_base_for_quote`,
    arguments: [
      tx.object(p.address),
      coinWithBalance({ type: base.type, balance: toBaseUnits(baseAmount, p.baseCoin) }),
      coinWithBalance({ type: deep.type, balance: toBaseUnits(deepAmount, "DEEP") }),
      tx.pure.u64(toBaseUnits(minQuoteOut, p.quoteCoin)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.transferObjects([baseOut, quoteOut, deepOut], recipient);
  tx.setGasBudget(100_000_000);
  return tx;
}

/** Swap exact quote → base (e.g. sell DBUSDC → SUI). Coins from wallet. */
export function buildSwapQuoteForBase(
  poolKey: string,
  quoteAmount: number,
  deepAmount: number,
  minBaseOut: number,
  recipient: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);
  const deep = getCoin("DEEP");

  const tx = new Transaction();
  const [baseOut, quoteOut, deepOut] = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_quote_for_base`,
    arguments: [
      tx.object(p.address),
      coinWithBalance({ type: quote.type, balance: toBaseUnits(quoteAmount, p.quoteCoin) }),
      coinWithBalance({ type: deep.type, balance: toBaseUnits(deepAmount, "DEEP") }),
      tx.pure.u64(toBaseUnits(minBaseOut, p.baseCoin)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.transferObjects([baseOut, quoteOut, deepOut], recipient);
  tx.setGasBudget(100_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWAPS — VIA BALANCE MANAGER (TradeCap + DepositCap + WithdrawCap)
// ═══════════════════════════════════════════════════════════════════════════════

/** Swap base→quote through BalanceManager (all 3 caps required). */
export function buildSwapBaseForQuoteWithManager(
  poolKey: string,
  managerAddress: string,
  tradeCapId: string,
  depositCapId: string,
  withdrawCapId: string,
  baseAmount: number,
  minQuoteOut: number,
  recipient: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const [baseOut, quoteOut] = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_base_for_quote_with_manager`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      tx.object(tradeCapId),
      tx.object(depositCapId),
      tx.object(withdrawCapId),
      coinWithBalance({ type: base.type, balance: toBaseUnits(baseAmount, p.baseCoin) }),
      tx.pure.u64(toBaseUnits(minQuoteOut, p.quoteCoin)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.transferObjects([baseOut, quoteOut], recipient);
  tx.setGasBudget(100_000_000);
  return tx;
}

/** Swap quote→base through BalanceManager (all 3 caps required). */
export function buildSwapQuoteForBaseWithManager(
  poolKey: string,
  managerAddress: string,
  tradeCapId: string,
  depositCapId: string,
  withdrawCapId: string,
  quoteAmount: number,
  minBaseOut: number,
  recipient: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const [baseOut, quoteOut] = tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_quote_for_base_with_manager`,
    arguments: [
      tx.object(p.address),
      tx.object(managerAddress),
      tx.object(tradeCapId),
      tx.object(depositCapId),
      tx.object(withdrawCapId),
      coinWithBalance({ type: quote.type, balance: toBaseUnits(quoteAmount, p.quoteCoin) }),
      tx.pure.u64(toBaseUnits(minBaseOut, p.baseCoin)),
      tx.object(CLOCK_ID),
    ],
    typeArguments: [base.type, quote.type],
  });
  tx.transferObjects([baseOut, quoteOut], recipient);
  tx.setGasBudget(100_000_000);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REBATES & MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

/** Claim maker rebates for a pool. */
export function buildClaimRebates(
  poolKey: string,
  managerAddress: string,
  tradeCapId?: string,
): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  const proof = tradeProof(tx, managerAddress, tradeCapId);
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::claim_rebates`,
    arguments: [tx.object(p.address), tx.object(managerAddress), proof],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

/** Update pool to latest allowed versions (permissionless maintenance call). */
export function buildUpdatePoolVersions(poolKey: string): Transaction {
  const p = getPool(poolKey);
  const base = getCoin(p.baseCoin);
  const quote = getCoin(p.quoteCoin);

  const tx = new Transaction();
  tx.moveCall({
    target: `${DEEPBOOK_PACKAGE_ID}::pool::update_pool_allowed_versions`,
    arguments: [tx.object(p.address), tx.object(REGISTRY_ID)],
    typeArguments: [base.type, quote.type],
  });
  tx.setGasBudget(50_000_000);
  return tx;
}

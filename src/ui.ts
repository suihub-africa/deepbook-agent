import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { AgentState } from "./types.js";
import { POOLS, COINS } from "./constants.js";

// ─── Palette ──────────────────────────────────────────────────────────────────
export const c = {
  brand:   chalk.hex("#4FC3F7"),
  dim:     chalk.gray,
  success: chalk.hex("#81C784"),
  error:   chalk.hex("#E57373"),
  warn:    chalk.hex("#FFB74D"),
  label:   chalk.hex("#B0BEC5"),
  value:   chalk.white.bold,
  muted:   chalk.hex("#546E7A"),
  accent:  chalk.hex("#CE93D8"),
  bid:     chalk.hex("#66BB6A"),
  ask:     chalk.hex("#EF5350"),
  swap:    chalk.hex("#29B6F6"),
  tx:      chalk.hex("#78909C"),
  pool:    chalk.hex("#FFF176"),
};

// ─── Banner ───────────────────────────────────────────────────────────────────
export function printBanner(): void {
  const line = c.muted("─".repeat(62));
  console.log();
  console.log(line);
  console.log(
    c.brand.bold("  ◆ DeepBook Agent") +
    c.dim("  ·  Sui Testnet  ·  PTB-native  ·  Gemini AI"),
  );
  console.log(c.muted("  Type a command or describe what you want in plain English."));
  console.log(
    c.muted("  Type ") + c.label("help") +
    c.muted(" for a reference, ") + c.label("exit") + c.muted(" to quit."),
  );
  console.log(line);
  console.log();
}

// ─── Help ─────────────────────────────────────────────────────────────────────
export function printHelp(): void {
  const row = (cmd: string, desc: string) =>
    `  ${c.brand(cmd.padEnd(40))} ${c.dim(desc)}`;
  const sec = (title: string) =>
    `\n  ${c.label("── " + title + " " + "─".repeat(Math.max(0, 54 - title.length)))}`;

  console.log();
  console.log(sec("Setup"));
  console.log(row("status",                               "wallet · manager · open orders · stats"));
  console.log(row("create manager",                       "create & share a new BalanceManager"));
  console.log(row("register manager",                     "register manager with the global registry"));
  console.log(row("caps",                                 "show stored capability object IDs"));

  console.log(sec("Capabilities  (owner-only minting)"));
  console.log(row("mint trade cap [to <addr>]",           "TradeCap — delegate order placement"));
  console.log(row("mint deposit cap [to <addr>]",         "DepositCap — delegate deposits"));
  console.log(row("mint withdraw cap [to <addr>]",        "WithdrawCap — delegate withdrawals"));
  console.log(row("revoke trade cap <capId>",             "permanently revoke a TradeCap on-chain"));
  console.log(row("set trade cap <capId>",                "use this TradeCap for orders"));
  console.log(row("set deposit cap <capId>",              "use this DepositCap"));
  console.log(row("set withdraw cap <capId>",             "use this WithdrawCap"));

  console.log(sec("Deposits & Withdrawals"));
  console.log(row("deposit <COIN> <amount>",              "owner deposit  e.g. deposit SUI 5"));
  console.log(row("deposit with cap <COIN> <amount>",     "delegate deposit via DepositCap"));
  console.log(row("withdraw <COIN> <amount>",             "owner withdraw specific amount"));
  console.log(row("withdraw all <COIN>",                  "owner withdraw entire balance"));
  console.log(row("withdraw with cap <COIN> <amount>",    "delegate withdraw via WithdrawCap"));

  console.log(sec("Orders"));
  console.log(row("limit <POOL> <bid|ask> <price> <qty>", "place limit order (uses TradeCap if set)"));
  console.log(row("market <POOL> <bid|ask> <qty>",        "place market order"));
  console.log(row("modify <POOL> <orderId> <newQty>",     "reduce an order's quantity"));
  console.log(row("cancel <POOL> <orderId>",              "cancel a single order by ID"));
  console.log(row("cancel all <POOL>",                    "cancel all orders in a pool"));
  console.log(row("withdraw settled <POOL>",              "pull filled amounts from BalanceManager"));
  console.log(row("claim rebates <POOL>",                 "claim maker rebates"));

  console.log(sec("Swaps  (wallet-native)"));
  console.log(row("swap <POOL> <baseAmt> <deepAmt>",      "sell base→quote  e.g. swap SUI_DBUSDC 1 1"));
  console.log(row("rswap <POOL> <quoteAmt> <deepAmt>",    "sell quote→base  e.g. rswap SUI_DBUSDC 3 1"));

  console.log(sec("Swaps  (via BalanceManager caps)"));
  console.log(row("mswap <POOL> <baseAmt> [minOut]",      "base→quote through manager (all 3 caps)"));
  console.log(row("mrswap <POOL> <quoteAmt> [minOut]",    "quote→base through manager (all 3 caps)"));

  console.log(sec("Agent & Info"));
  console.log(row("run agent [N]",                        "run N Gemini-driven agentic cycles"));
  console.log(row("history [N]",                          "show last N activity entries"));
  console.log(row("pools",                                "list all pools"));
  console.log(row("coins",                                "list all coins & decimals"));
  console.log(row("exit",                                 "quit"));

  console.log(`\n  ${c.label("── Natural Language ─────────────────────────────────────────")}`);
  console.log(c.dim('  "place a 1 SUI bid at 3.20 on the USDC pool"'));
  console.log(c.dim('  "swap 2 SUI for DBUSDC"'));
  console.log(c.dim('  "mint me a trade cap"'));
  console.log(c.dim('  "cancel all my orders on DEEP_SUI"'));
  console.log(c.dim('  "run 3 agent cycles"'));
  console.log();
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
export function prompt(): string {
  return c.muted("  > ");
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function spin(text: string): Ora {
  return ora({
    text: c.dim(text),
    spinner: "dots",
    color: "cyan",
    prefixText: " ",
  }).start();
}

// ─── Result printers ──────────────────────────────────────────────────────────
export function printTx(action: string, digest: string, extra = ""): void {
  console.log(`\n  ${c.success("✔")} ${c.label(action)}` + (extra ? `  ${c.dim(extra)}` : ""));
  console.log(`  ${c.muted("tx")} ${c.tx(digest)}`);
}

export function printError(msg: string): void {
  console.log(`\n  ${c.error("✖")} ${c.error(msg)}\n`);
}

export function printWarn(msg: string): void {
  console.log(`  ${c.warn("⚠")}  ${c.warn(msg)}`);
}

export function printInfo(msg: string): void {
  console.log(`  ${c.brand("·")} ${c.dim(msg)}`);
}

export function printAI(text: string): void {
  process.stdout.write(`\n  ${c.accent("◆")} ${c.accent("Gemini")}  `);
  process.stdout.write(c.dim(text));
  process.stdout.write("\n");
}

// ─── Status block ─────────────────────────────────────────────────────────────
export function printStatus(
  address: string,
  suiBalance: bigint,
  state: AgentState,
): void {
  const sep = c.muted("  " + "─".repeat(58));
  console.log();
  console.log(sep);
  console.log(`  ${c.label("Wallet  ")} ${c.value(address)}`);
  console.log(`  ${c.label("Balance ")} ${c.value((Number(suiBalance) / 1e9).toFixed(4))} ${c.dim("SUI")}`);
  console.log(
    `  ${c.label("Manager ")} ${
      state.balanceManagerId
        ? c.value(state.balanceManagerId)
        : c.warn("not created — run: create manager")
    }`,
  );
  console.log(sep);

  const allOrders = Object.entries(state.openOrders);
  if (allOrders.every(([, v]) => v.length === 0)) {
    console.log(`  ${c.muted("No open orders tracked locally.")}`);
  } else {
    console.log(`  ${c.label("Open Orders:")}`);
    for (const [pool, orders] of allOrders) {
      if (!orders.length) continue;
      console.log(`  ${c.pool("  " + pool)}`);
      for (const o of orders) {
        const side = o.side === "bid" ? c.bid("BID") : c.ask("ASK");
        console.log(
          `    ${side}  ${c.value(String(o.qty))}  @  ${c.value(String(o.price))}  ${c.muted(o.ts?.slice(11, 19) ?? "")}`,
        );
      }
    }
  }

  const s = state.stats;
  console.log(sep);
  console.log(
    `  ${c.label("Orders")} ${c.value(String(s.totalOrders))}` +
    `   ${c.label("Swaps")} ${c.value(String(s.totalSwaps))}` +
    `   ${c.label("Cancels")} ${c.value(String(s.totalCancels))}` +
    `   ${c.label("Deposits")} ${c.value(String(s.totalDeposits))}`,
  );
  console.log(sep);
  console.log();
}

// ─── Pools / Coins ────────────────────────────────────────────────────────────
export function printPools(): void {
  console.log();
  console.log(`  ${c.label("Pool Key".padEnd(18))} ${c.label("Base".padEnd(10))} ${c.label("Quote")}`);
  console.log(`  ${c.muted("─".repeat(44))}`);
  for (const [key, p] of Object.entries(POOLS)) {
    console.log(`  ${c.pool(key.padEnd(18))} ${c.brand(p.baseCoin.padEnd(10))} ${c.brand(p.quoteCoin)}`);
  }
  console.log();
}

export function printCoins(): void {
  console.log();
  console.log(`  ${c.label("Coin".padEnd(10))} ${c.label("Decimals".padEnd(12))} ${c.label("Type")}`);
  console.log(`  ${c.muted("─".repeat(70))}`);
  for (const [key, coin] of Object.entries(COINS)) {
    const decimals = Math.log10(Number(coin.scalar));
    console.log(
      `  ${c.brand(key.padEnd(10))} ${c.dim(String(decimals).padEnd(12))} ${c.muted(coin.type.slice(0, 52) + "...")}`,
    );
  }
  console.log();
}

// ─── History ──────────────────────────────────────────────────────────────────
export function printHistory(log: AgentState["activityLog"], n = 10): void {
  const entries = log.slice(-n);
  console.log();
  if (!entries.length) { console.log(c.muted("  No activity yet.")); console.log(); return; }
  for (const e of entries) {
    const time = c.muted((e.ts as string)?.slice(11, 19) ?? "");
    const action = c.brand(String(e.action).padEnd(24));
    const detail = Object.entries(e)
      .filter(([k]) => !["ts", "action"].includes(k))
      .map(([k, v]) => `${c.label(k)}${c.dim("=")}${c.value(String(v).slice(0, 20))}`)
      .join("  ");
    console.log(`  ${time}  ${action}  ${detail}`);
  }
  console.log();
}

// ─── Agent cycle ──────────────────────────────────────────────────────────────
export function printCycleHeader(n: number): void {
  console.log();
  console.log(c.muted("  ─── ") + c.brand(`Agent Cycle #${n}`) + c.muted(" ──────────────────────────────────────"));
}

export function printCycleFooter(stats: AgentState["stats"]): void {
  console.log(
    `\n  ${c.muted("Cycle done ·")}` +
    `  orders ${c.value(String(stats.totalOrders))}` +
    `  swaps ${c.value(String(stats.totalSwaps))}` +
    `  cancels ${c.value(String(stats.totalCancels))}`,
  );
  console.log();
}

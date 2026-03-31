#!/usr/bin/env npx tsx
/**
 * repl.ts — Interactive DeepBook Agent Chat
 *
 * Type naturally. The AI responds in prose, calls tools, executes on-chain.
 * Run:  npx tsx src/repl.ts
 */

import "dotenv/config";
import { createInterface } from "readline";
import { SuiClient } from "./client.js";
import { DeepBookAgent } from "./agent.js";
import { loadState } from "./state.js";
import chalk from "chalk";

// ─── Validate env ─────────────────────────────────────────────────────────────
if (!process.env.SUI_PRIVATE_KEY) {
  console.error(chalk.red("\n  ✖  SUI_PRIVATE_KEY not set in .env\n"));
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error(
    chalk.red("\n  ✖  Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env\n"),
  );
  process.exit(1);
}

// ─── Terminal helpers ─────────────────────────────────────────────────────────
const c = {
  brand: chalk.hex("#4FC3F7"),
  dim: chalk.gray,
  success: chalk.hex("#81C784"),
  error: chalk.hex("#E57373"),
  warn: chalk.hex("#FFB74D"),
  ai: chalk.hex("#CE93D8"),
  tool: chalk.hex("#4DB6AC"),
  tx: chalk.hex("#78909C"),
  muted: chalk.hex("#546E7A"),
  user: chalk.white.bold,
};

function printBanner(agent: DeepBookAgent, address: string): void {
  console.log();
  console.log(chalk.hex("#546E7A")("─".repeat(62)));
  console.log(
    c.brand.bold("  ◆ DeepBook Agent") +
      c.dim(`  ·  ${agent.getBackend()}  ·  Sui Testnet`),
  );
  console.log(c.dim(`  wallet  ${address}`));
  console.log(c.dim("  Type anything — ask questions or give instructions."));
  console.log(c.dim("  Ctrl+C to quit  ·  type 'clear' to reset conversation"));
  console.log(chalk.hex("#546E7A")("─".repeat(62)));
  console.log();
}

function printToolCall(name: string, input: Record<string, unknown>): void {
  const args = Object.entries(input)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  process.stdout.write(
    `\n  ${c.tool("⚙")} ${c.tool(name)}${args ? c.dim(`(${args})`) : ""}\n`,
  );
}

function printToolResult(name: string, result: string): void {
  const firstLine = result.split("\n")[0];
  const hasTx = result.includes("Tx:");
  const txLine = hasTx
    ? (result.split("\n").find((l) => l.includes("Tx:")) ?? "")
    : "";
  process.stdout.write(
    `  ${c.success("✔")} ${c.dim(firstLine)}\n` +
      (txLine
        ? `  ${c.muted("tx")} ${c.tx(txLine.replace("Tx:", "").trim())}\n`
        : ""),
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  let client: SuiClient;
  try {
    client = new SuiClient(process.env.SUI_PRIVATE_KEY!);
  } catch (err) {
    console.error(
      chalk.red(`\n  ✖  Invalid private key: ${(err as Error).message}\n`),
    );
    process.exit(1);
  }

  const state = loadState();
  const agent = new DeepBookAgent();

  printBanner(agent, client.address);

  if (state.balanceManagerId) {
    console.log(c.dim(`  manager  ${state.balanceManagerId}`));
    console.log();
  }

  // ── Readline setup ──────────────────────────────────────────────────────────
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: `\n${c.muted("  You  ")} `,
  });

  rl.prompt();

  rl.on("line", async (raw: string) => {
    rl.pause();
    const input = raw.trim();

    if (!input) {
      rl.resume();
      rl.prompt();
      return;
    }

    // Built-in commands
    if (/^(exit|quit)$/i.test(input)) {
      console.log(`\n  ${c.dim("Goodbye.")}\n`);
      process.exit(0);
    }

    if (/^clear$/i.test(input)) {
      agent.clearHistory();
      console.clear();
      printBanner(agent, client.address);
      rl.resume();
      rl.prompt();
      return;
    }

    // Print AI label before streaming
    process.stdout.write(`\n${c.ai("  Agent")} `);

    let isFirstToken = true;

    await agent.chat(input, client, state, {
      onToken: (token: string) => {
        if (isFirstToken) {
          isFirstToken = false;
        }
        process.stdout.write(c.dim(token));
      },
      onToolCall: (name: string, inp: Record<string, unknown>) => {
        // Print a newline before tool output so it's on its own line
        if (!isFirstToken) process.stdout.write("\n");
        printToolCall(name, inp);
        // Reset so next AI text starts fresh
        process.stdout.write(`\n${c.ai("  Agent")} `);
        isFirstToken = true;
      },
      onToolResult: (name: string, result: string) => {
        if (!isFirstToken) process.stdout.write("\n");
        printToolResult(name, result);
        process.stdout.write(`\n${c.ai("  Agent")} `);
        isFirstToken = true;
      },
      onProgress: (msg: string) => {
        // Small inline progress note — overwrite same line
        process.stdout.write(
          `\r  ${c.tool("⠋")} ${c.dim(msg)}                    `,
        );
      },
    });

    // Ensure we end on a newline
    process.stdout.write("\n");

    rl.resume();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\n  ${c.dim("Session ended.")}\n`);
    process.exit(0);
  });

  rl.on("SIGINT", () => {
    console.log(`\n  ${c.dim("Ctrl-C — type 'exit' to quit.")}\n`);
    rl.prompt();
  });
}

main().catch((err) => {
  console.error(chalk.red(`\n  ✖  Fatal: ${(err as Error).message}\n`));
  process.exit(1);
});

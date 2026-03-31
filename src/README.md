# DeepBook Agent — TypeScript

Interactive Claude Code-style terminal for **DeepBook V3 on Sui testnet**.  
Raw PTBs via `@mysten/sui` — zero DeepBook SDK — full TypeScript strict mode.

## Quick Start

```bash
npm install
cp .env.example .env       # fill in SUI_PRIVATE_KEY + GEMINI_API_KEY
npm start                  # npx tsx src/repl.ts
```

## Get your private key

```bash
sui keytool export --key-identity <your-address>
# copy the suiprivkey1... value into .env
```

## Scripts

| Command | What it does |
|---------|-------------|
| `npm start` | Launch the interactive REPL |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
src/
├── repl.ts        ← entry point  (npm start)
├── types.ts       ← all TypeScript interfaces & discriminated union types
├── constants.ts   ← pool/coin addresses, conversion helpers
├── deepbook.ts    ← every DeepBook V3 PTB builder (raw tx.moveCall)
├── client.ts      ← SuiJsonRpcClient wrapper (sign + execute)
├── parser.ts      ← regex fast-path + Gemini NL fallback
├── executor.ts    ← dispatches ParsedAction → PTB → chain
├── agent.ts       ← Gemini agentic loop brain
├── state.ts       ← persists manager ID, caps, orders, activity log
└── ui.ts          ← chalk terminal renderer
```

## First-time flow

```
  > create manager           ← creates + shares BalanceManager on-chain
  > deposit SUI 5            ← fund the manager
  > deposit DEEP 100         ← for trading fees
  > mint trade cap           ← optional: delegate trading cap
  > limit SUI_DBUSDC bid 3.2 1
  > limit SUI_DBUSDC ask 3.9 1
  > swap SUI_DBUSDC 1 1      ← wallet-native swap
  > run agent 3              ← Gemini places 3 cycles of orders
  > status                   ← show balances + open orders
  > help                     ← full command reference
```

## All Commands

### Setup
```
status                          wallet · manager · open orders · stats
create manager                  create & share a new BalanceManager
register manager                register with global registry
caps                            show stored capability IDs
```

### Capabilities
```
mint trade cap [to <addr>]      TradeCap — delegate order placement
mint deposit cap [to <addr>]    DepositCap — delegate deposits
mint withdraw cap [to <addr>]   WithdrawCap — delegate withdrawals
revoke trade cap <capId>        burn a TradeCap on-chain
set trade cap <capId>           use this cap for orders
set deposit cap <capId>         use this cap for deposits
set withdraw cap <capId>        use this cap for withdrawals
```

### Deposits & Withdrawals
```
deposit <COIN> <amount>         owner deposit
deposit with cap <COIN> <amt>   delegate deposit via DepositCap
withdraw <COIN> <amount>        owner withdraw
withdraw all <COIN>             withdraw entire balance
withdraw with cap <COIN> <amt>  delegate withdraw via WithdrawCap
```

### Orders
```
limit <POOL> <bid|ask> <px> <qty>   place limit order
market <POOL> <bid|ask> <qty>       place market order
modify <POOL> <orderId> <newQty>    reduce order quantity
cancel <POOL> <orderId>             cancel single order
cancel all <POOL>                   cancel all orders in pool
withdraw settled <POOL>             pull filled amounts
claim rebates <POOL>                claim maker rebates
```

### Swaps (wallet-native)
```
swap <POOL> <baseAmt> <deepAmt>     sell base → quote
rswap <POOL> <quoteAmt> <deepAmt>   sell quote → base
```

### Swaps (via BalanceManager caps)
```
mswap <POOL> <baseAmt> [minOut]     base→quote through manager
mrswap <POOL> <quoteAmt> [minOut]   quote→base through manager
```

### Agent & Info
```
run agent [N]       run N Gemini-driven agentic cycles
history [N]         show last N activity entries
pools               list all available pools
coins               list coins & decimals
exit                quit
```

### Natural Language
Any of the above also works as plain English:
```
"place a 1 SUI bid at 3.20 on the USDC pool"
"mint me a trade cap"
"swap 2 SUI for DBUSDC"
"cancel all my orders on DEEP_SUI"
"run 3 agent cycles"
```

## Pools

| Key | Base | Quote |
|-----|------|-------|
| DEEP_SUI | DEEP | SUI |
| SUI_DBUSDC | SUI | DBUSDC |
| DEEP_DBUSDC | DEEP | DBUSDC |
| DBUSDT_DBUSDC | DBUSDT | DBUSDC |
| WAL_DBUSDC | WAL | DBUSDC |
| WAL_SUI | WAL | SUI |
| DBTC_DBUSDC | DBTC | DBUSDC |

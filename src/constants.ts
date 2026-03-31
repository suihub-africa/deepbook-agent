import type { CoinMeta, PoolMeta } from "./types.js";

// ─── Package Addresses ────────────────────────────────────────────────────────

export const DEEPBOOK_PACKAGE_ID =
  "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c";
export const REGISTRY_ID =
  "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1";
export const DEEP_TREASURY_ID =
  "0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb";
export const CLOCK_ID = "0x6";

// ─── Coins ────────────────────────────────────────────────────────────────────

export const COINS: Record<string, CoinMeta> = {
  DEEP: {
    address: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8",
    type: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
    scalar: 1_000_000n,
  },
  SUI: {
    address: "0x0000000000000000000000000000000000000000000000000000000000000002",
    type: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    scalar: 1_000_000_000n,
  },
  DBUSDC: {
    address: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7",
    type: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC",
    scalar: 1_000_000n,
  },
  DBUSDT: {
    address: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7",
    type: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDT::DBUSDT",
    scalar: 1_000_000n,
  },
  DBTC: {
    address: "0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86",
    type: "0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86::dbtc::DBTC",
    scalar: 100_000_000n,
  },
  WAL: {
    address: "0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76",
    type: "0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL",
    scalar: 1_000_000_000n,
  },
};

// ─── Pools ────────────────────────────────────────────────────────────────────

export const POOLS: Record<string, PoolMeta> = {
  DEEP_SUI: {
    address: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
    baseCoin: "DEEP",
    quoteCoin: "SUI",
  },
  SUI_DBUSDC: {
    address: "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5",
    baseCoin: "SUI",
    quoteCoin: "DBUSDC",
  },
  DEEP_DBUSDC: {
    address: "0xe86b991f8632217505fd859445f9803967ac84a9d4a1219065bf191fcb74b622",
    baseCoin: "DEEP",
    quoteCoin: "DBUSDC",
  },
  DBUSDT_DBUSDC: {
    address: "0x83970bb02e3636efdff8c141ab06af5e3c9a22e2f74d7f02a9c3430d0d10c1ca",
    baseCoin: "DBUSDT",
    quoteCoin: "DBUSDC",
  },
  WAL_DBUSDC: {
    address: "0xeb524b6aea0ec4b494878582e0b78924208339d360b62aec4a8ecd4031520dbb",
    baseCoin: "WAL",
    quoteCoin: "DBUSDC",
  },
  WAL_SUI: {
    address: "0x8c1c1b186c4fddab1ebd53e0895a36c1d1b3b9a77cd34e607bef49a38af0150a",
    baseCoin: "WAL",
    quoteCoin: "SUI",
  },
  DBTC_DBUSDC: {
    address: "0x0dce0aa771074eb83d1f4a29d48be8248d4d2190976a5241f66b43ec18fa34de",
    baseCoin: "DBTC",
    quoteCoin: "DBUSDC",
  },
};

// ─── Order Constants ──────────────────────────────────────────────────────────

export const ORDER_TYPE = {
  NO_RESTRICTION: 0,
  IMMEDIATE_OR_CANCEL: 1,
  FILL_OR_KILL: 2,
  POST_ONLY: 3,
} as const;

export const SELF_MATCHING = {
  ALLOWED: 0,
  CANCEL_TAKER: 1,
  CANCEL_MAKER: 2,
} as const;

/** DeepBook internal price float scalar (1e9) */
export const FLOAT_SCALAR = 1_000_000_000n;

/** GTC expiration — max u64 */
export const MAX_TIMESTAMP = 18_446_744_073_709_551_615n;

// ─── Conversion Helpers ───────────────────────────────────────────────────────

/** Convert human amount → on-chain base units */
export function toBaseUnits(humanAmount: number, coinKey: string): bigint {
  const c = COINS[coinKey];
  if (!c) throw new Error(`Unknown coin: ${coinKey}`);
  return BigInt(Math.round(humanAmount * Number(c.scalar)));
}

/**
 * Convert human price → DeepBook internal price representation.
 * Formula: price * FLOAT_SCALAR * baseCoin.scalar / quoteCoin.scalar
 */
export function toInternalPrice(
  humanPrice: number,
  baseCoinKey: string,
  quoteCoinKey: string,
): bigint {
  const base = COINS[baseCoinKey];
  const quote = COINS[quoteCoinKey];
  if (!base) throw new Error(`Unknown base coin: ${baseCoinKey}`);
  if (!quote) throw new Error(`Unknown quote coin: ${quoteCoinKey}`);
  return BigInt(
    Math.round(
      (humanPrice * Number(FLOAT_SCALAR) * Number(base.scalar)) /
        Number(quote.scalar),
    ),
  );
}

/** Random u64 client order ID */
export function randomClientOrderId(): bigint {
  return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

/** Lookup coin — throws on unknown key */
export function getCoin(key: string): CoinMeta {
  const c = COINS[key];
  if (!c) throw new Error(`Unknown coin: ${key}`);
  return c;
}

/** Lookup pool — throws on unknown key */
export function getPool(key: string): PoolMeta {
  const p = POOLS[key];
  if (!p) throw new Error(`Unknown pool: ${key}`);
  return p;
}

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import type { Transaction } from "@mysten/sui/transactions";

export interface CreatedObject {
  id: string;
  type: string;
}

export class SuiClient {
  readonly keypair: Ed25519Keypair;
  readonly address: string;
  readonly rpc: SuiJsonRpcClient;
  readonly network: "testnet" | "mainnet";

  constructor(privateKey: string, network: "testnet" | "mainnet" = "testnet") {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme !== "ED25519") throw new Error(`Unsupported key scheme: ${scheme}`);
    this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
    this.address = this.keypair.toSuiAddress();
    this.rpc = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(network), network });
    this.network = network;
  }

  /**
   * Sign and execute a Transaction using signAndExecuteTransaction.
   * Throws if the transaction does not succeed.
   */
  async execute(tx: Transaction): Promise<SuiTransactionBlockResponse> {
    tx.setSenderIfNotSet(this.address);

    const result = await this.rpc.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    });

    const status = result.effects?.status?.status;
    if (status !== "success") {
      const err = result.effects?.status?.error ?? "Unknown error";
      throw new Error(`Transaction failed: ${err}`);
    }
    return result;
  }

  /** Parse created objects from a transaction result. */
  getCreatedObjects(result: SuiTransactionBlockResponse): CreatedObject[] {
    return (result.objectChanges ?? [])
      .filter((c) => c.type === "created")
      .map((c) => ({
        id: (c as { objectId: string; objectType: string }).objectId,
        type: (c as { objectId: string; objectType: string }).objectType,
      }));
  }

  /** Get total SUI balance for this wallet. */
  async getSuiBalance(): Promise<bigint> {
    const coins = await this.rpc.getCoins({
      owner: this.address,
      coinType:
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    });
    return coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  }

  /** Request testnet SUI from the faucet. */
  async requestFaucet(): Promise<unknown> {
    const res = await fetch("https://faucet.testnet.sui.io/v1/gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ FixedAmountRequest: { recipient: this.address } }),
    });
    return res.json();
  }
}

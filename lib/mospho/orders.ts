import {
  bytesToHex,
  getAddress,
  hexToBytes,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { analyze } from "./analyze.ts";
import { normalizeInput, type LabResult } from "./shared.ts";
import { abi } from "./chain.ts";

import type { LabStore } from "./storage.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
type Rpc = Pick<
  typeof import("./chain.ts").publicClient,
  "getChainId" | "getBlockNumber" | "readContract"
>;
export interface Market {
  address: Address;
  chainId: number;
  price: bigint;
}

function privateTicket(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value))
    throw new HttpError(400, "Invalid request receipt.");
  const secret = value as Hex;
  return { ticket: keccak256(secret), secret };
}
const keyFor = (secret: Hex) =>
  crypto.subtle.importKey(
    "raw",
    Uint8Array.from(hexToBytes(secret)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );

export async function prepareOrder(
  db: LabStore,
  market: Market,
  raw: Record<string, unknown>,
) {
  const { secret, ticket } = privateTicket(raw.secret);
  if (typeof raw.payer !== "string" || !isAddress(raw.payer))
    throw new HttpError(400, "Invalid wallet address.");
  const payer = getAddress(raw.payer);
  const input = normalizeInput(raw);
  const inputHash = keccak256(stringToHex(JSON.stringify(input)));
  let row = await db.order(ticket);
  if (!row) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await keyFor(secret),
      new TextEncoder().encode(JSON.stringify(analyze(input))),
    );
    await db.createOrder(ticket, {
      payer,
      contract: market.address,
      chain_id: String(market.chainId),
      input_hash: inputHash,
      cipher: bytesToHex(new Uint8Array(cipher)),
      iv: bytesToHex(iv),
    });
    row = await db.order(ticket);
  }
  if (
    !row ||
    row.input_hash !== inputHash ||
    row.payer !== payer ||
    row.contract !== market.address ||
    row.chain_id !== String(market.chainId)
  ) {
    throw new HttpError(
      409,
      "This receipt is already linked to another request.",
    );
  }
  return {
    ticket,
    contract: market.address,
    chainId: market.chainId,
    unitPriceWei: String(market.price),
  };
}

export async function redeemOrder(
  db: LabStore,
  market: Market,
  rpc: Rpc,
  raw: Record<string, unknown>,
) {
  const { secret, ticket } = privateTicket(raw.secret);
  const row = await db.order(ticket);
  if (
    !row ||
    row.contract !== market.address ||
    row.chain_id !== String(market.chainId)
  )
    throw new HttpError(404, "Request not found.");
  const [chainId, head] = await Promise.all([
    rpc.getChainId(),
    rpc.getBlockNumber({ cacheTime: 0 }),
  ]);
  if (chainId !== market.chainId)
    throw new HttpError(
      503,
      "The RPC endpoint is connected to the wrong network.",
    );
  const currency = await rpc.readContract({
    address: market.address,
    abi,
    functionName: "payments",
    args: [row.payer, ticket],
    blockNumber: head > 1n ? head - 1n : 0n,
  });
  if (currency !== 1 && currency !== 2)
    throw new HttpError(202, "Waiting for two payment confirmations.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(hexToBytes(row.iv)) },
    await keyFor(secret),
    Uint8Array.from(hexToBytes(row.cipher)),
  );
  return {
    result: JSON.parse(new TextDecoder().decode(plain)) as LabResult,
    currency: currency === 1 ? "ETH" : "MOSPHO",
    ticket,
  };
}

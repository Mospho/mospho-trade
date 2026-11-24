import {
  createPublicClient,
  defineChain,
  fallback,
  formatEther,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import networks from "../../config/chains.json" with { type: "json" };
import manifest from "../../config/deployment.json" with { type: "json" };
import launch from "../../config/launch.json" with { type: "json" };

export const network = networks["4663"];
export const chain = defineChain({
  id: 4663,
  name: network.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: network.rpcs } },
  blockExplorers: { default: { name: "Blockscout", url: network.explorer } },
});
export const publicClient = createPublicClient({
  chain,
  transport: fallback(
    network.rpcs.map((url) => http(url, { timeout: 4500, retryCount: 0 })),
    { retryCount: 1 },
  ),
});
export const contract = manifest.address as Address | null;
export const creationTx = manifest.transaction as Hex | null;
export const unitPrice = BigInt(manifest.unitPriceWei ?? launch.unitPriceWei);
export const priceDisplay = formatEther(unitPrice);
export const abi = parseAbi([
  "function payETH(bytes32 ticket) payable",
  "function payMOSPHO(bytes32 ticket)",
  "function payments(address payer, bytes32 ticket) view returns (uint8)",
  "function tokenLive() view returns (bool)",
  "function buyTokens(uint32 units) payable",
  "function balanceOf(address payer) view returns (uint256)",
  "function unitPrice() view returns (uint256)",
  "function treasury() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "event RequestPaid(address indexed payer, bytes32 indexed ticket, uint8 currency, uint256 amount)",
]);
export const shortAddress = (value: string) =>
  value.slice(0, 6) + "…" + value.slice(-4);

# mospho.trade

Official source excerpts for [mospho.trade](https://mospho.trade), a pay-per-request research terminal on Robinhood Chain.

**X:** [@TryMospho](https://x.com/TryMospho) · **$MOSPHO CA:** `0x3519019b871f9a3f84126c17db146336f9061dd2` · [Buy on Pons](https://ponsfamily.com/launchpad/0x3519019b871f9a3f84126c17db146336f9061dd2)

Paste a source (notes, an article, a transcript, English or Chinese). Pick a task: **Summary**, **Text Q&A** or **Keywords**. Pay once from your own wallet. Every finding cites the sentence it came from.

This repository holds selected parts of the production code. The full application, its deployment tooling and infrastructure are kept private.

## What is here

| Path | What it does |
| --- | --- |
| `contracts/MosphoLab.sol` | The settlement contract. Fixed treasury and price per request, `payETH(ticket)`, the MOSPHO token (zero supply until the treasury opens it), `payMOSPHO(ticket)` burns one token per request, `claimRevenue()` always pays the fixed treasury. |
| `lib/mospho/analyze.ts` | Mospho Extract: sentence ranking for summaries, grounded answers with supporting quotes, and keyword extraction. Runs on the server with no external inference API. |
| `lib/semantic/index.ts` | Tokenizer and embeddings over compact English and Chinese aligned fastText vectors. The vector file is not included (see Sources). |
| `lib/mospho/orders.ts` | Sealed checkout. The result is prepared and encrypted with AES-GCM under a random receipt key that never leaves the visitor's browser. Only the key's hash goes on chain. The result is released after the payer's receipt has two confirmations. |
| `lib/mospho/chain.ts` | Robinhood Chain client, contract ABI and fixed terms. |
| `lib/visual/bot3d.ts` | The Mospho companion: a live three.js character with pointer-tracking eyes, blinking and talk animation. |
| `config/` | Public network endpoints and the fixed request price. |

## Request flow

1. **Source**: the browser sends the text and task to the server.
2. **Inference**: Mospho Extract ranks sentences or terms; each finding keeps its sentence number.
3. **Settlement**: the server seals the result; the wallet calls `payETH(keccak256(receiptKey))`.
4. **Receipt**: after two confirmations the browser presents the receipt key and the server decrypts the result for that payer only.

## Deployment

| | |
| --- | --- |
| Network | Robinhood Chain mainnet, chain ID 4663 |
| Price | 0.00001 ETH per request, plus gas |
| $MOSPHO CA | `0x3519019b871f9a3f84126c17db146336f9061dd2` |
| Buy | [Pons](https://ponsfamily.com/launchpad/0x3519019b871f9a3f84126c17db146336f9061dd2) |
| X | [@TryMospho](https://x.com/TryMospho) |

## Links

- Site: [mospho.trade](https://mospho.trade)
- X: [@TryMospho](https://x.com/TryMospho)

## Sources

The semantic model adapts the [fastText aligned word vectors](https://fasttext.cc/docs/en/aligned-vectors.html) (Facebook AI Research, CC BY-SA 3.0).

## License

Copyright 2026 Mospho Liquidator Lab. All rights reserved. The code is published for reference and verification; no license to reuse it is granted.

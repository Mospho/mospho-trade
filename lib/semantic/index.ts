import model from "./model.json" with { type: "json" };

type Language = "en" | "zh";

const stops = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its may of on or our should than that the their them then there these they this those to us was we were what when where which who why will with would you your " +
    "啊 把 被 本 并 並 从 從 到 的 得 地 等 对 對 多 而 和 很 会 會 或 及 就 可 可以 了 吗 嗎 没有 沒有 每 那 哪 哪个 哪些 呢 能 你 您 其 请 請 让 讓 如 如何 谁 誰 什么 什麼 使 是 所 它 他们 他們 她们 她們 为 為 为何 為何 我 我们 我們 无 無 向 要 也 以 因为 因為 有 于 於 与 與 在 则 則 怎么 怎麼 这 這 这个 這個 这些 這些 着 著 之 只 中 其中 是否 请问 請問 多少"
  ).split(/\s+/),
);
const han = /\p{Script=Han}/u;
const wordRuns = /\p{Script=Han}+|[\p{Script=Latin}\p{N}]+/gu;
const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("zh-Hans", { granularity: "word" })
  : undefined;

function unpackModel() {
  const english = model.english.split(" ");
  const words = [...english, ...model.chinese.split(" ")];
  const lookup = new Map(words.map((word, i) => [word, i]));
  for (const [variant, index] of Object.entries(model.aliases)) {
    lookup.set(variant, english.length + index);
  }
  const bytes = atob(model.vectors);
  const weights = new Int8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) weights[i] = bytes.charCodeAt(i);
  return { lookup, weights };
}

let cache: ReturnType<typeof unpackModel> | undefined;

function tokenize(text: string, language?: Language): string[] {
  const normalized = text.normalize("NFKC").toLowerCase();
  if (segmenter && (language === "zh" || han.test(normalized))) {
    return Array.from(segmenter.segment(normalized))
      .filter((part) => part.isWordLike)
      .map((part) => part.segment);
  }
  return normalized.match(wordRuns) ?? [];
}

/** Split an unknown ICU word, or an unsegmented Han run, into known words. */
function chineseParts(token: string, lookup: Map<string, number>): string[] {
  const parts: string[] = [];
  const characters = Array.from(token);
  for (let start = 0; start < characters.length;) {
    let end = Math.min(characters.length, start + 8);
    let piece = characters.slice(start, end).join("");
    while (end > start + 1 && !lookup.has(piece)) {
      end--;
      piece = characters.slice(start, end).join("");
    }
    if (lookup.has(piece)) parts.push(piece);
    start = end;
  }
  return parts;
}

/** Mean of learned fastText vectors in a shared English–Chinese vector space. */
export function embedText(text: string, language?: Language): Float32Array {
  const tokens = tokenize(text, language);
  const embedding = new Float32Array(model.dimensions);
  if (tokens.length === 0) return embedding;

  const { lookup, weights } = (cache ??= unpackModel());
  for (const token of tokens) {
    if (stops.has(token)) continue;
    const parts = han.test(token) && !lookup.has(token)
      ? chineseParts(token, lookup)
      : [token];
    for (const part of parts) {
      const index = lookup.get(part);
      if (index === undefined || stops.has(part)) continue;
      const start = index * embedding.length;
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] += weights[start + i];
      }
    }
  }

  const length = Math.hypot(...embedding);
  if (length > 0) {
    for (let i = 0; i < embedding.length; i++) embedding[i] /= length;
  }
  return embedding;
}

/** Cosine over the unit vectors from embedText. Unknown-only input scores zero. */
export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) return 0;
  let total = 0;
  for (let i = 0; i < left.length; i++) total += left[i] * right[i];
  return Math.min(1, Math.max(-1, total));
}

import { cosineSimilarity, embedText } from "../semantic/index.ts";
import { type LabInput, type LabResult, type Finding } from "./shared.ts";

const stop = new Set(
  (
    "的 地 得 了 着 过 和 与 或 或者 而 并 及 也 都 是 有 在 为 将 会 能 可 可以 这 那 这些 那些 一个 一些 每个 我 我们 你 你们 他 他们 它 其 其中 中 对 于 从 到 向 以 把 被 让 等 什么 如何 为什么 哪个 哪些 哪里 怎么 是否 多少 吗 呢 请 看到 因为 所以 但是 这个 那个 可以 进行 他们 这些 " +
    "a an and are as at be been but by can do does for from has have how in into is it its may of on or our should than that the their them then there these this those to was were what when where which who why will with would you your see saw had before after"
  ).split(" "),
);

const han = /\p{Script=Han}/u;
const chineseWords = new Intl.Segmenter("zh-Hans", { granularity: "word" });
function terms(text: string) {
  const clean = text.normalize("NFKC").toLowerCase();
  const tokens = han.test(clean)
    ? Array.from(chineseWords.segment(clean))
        .filter((p) => p.isWordLike)
        .map((p) => p.segment)
    : (clean.match(/[\p{L}\d][\p{L}\d-]+/gu) ?? []);
  return tokens.filter((word) => !stop.has(word));
}

export function analyze(input: LabInput): LabResult {
  const splitter = new Intl.Segmenter(
    han.test(input.source) ? "zh-Hans" : "en",
    { granularity: "sentence" },
  );
  const sentences = input.source
    .split(/\n+/u)
    .flatMap((paragraph) =>
      Array.from(splitter.segment(paragraph), (part) =>
        part.segment.trim(),
      ).filter(Boolean),
    );
  const words = sentences.map(terms);
  const vectors = sentences.map((s) => embedText(s));
  const document = embedText(input.source);
  const query = input.mode === "ask" ? embedText(input.question) : document;
  const queryTerms = new Set(terms(input.question));
  const counts = new Map<string, number>();
  for (const sentence of words) {
    for (const word of new Set(sentence))
      counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const result: LabResult = {
    mode: input.mode,
    findings: [],
    sentenceCount: sentences.length,
  };
  if (input.mode === "keywords") {
    const candidates = [...counts.keys()]
      .filter((word) => word.length > 1 && /\p{L}/u.test(word))
      .map((word) => {
        const first = words.findIndex((s) => s.includes(word));
        const frequency = counts.get(word)!;
        const relevance = Math.max(
          0,
          cosineSimilarity(embedText(word), document),
        );
        return {
          word,
          first,
          score: Math.log1p(frequency) * (0.4 + relevance),
        };
      })
      .sort((a, b) => b.score - a.score);
    result.findings = candidates.slice(0, 5).map(({ word, first }) => ({
      label: word,
      text: sentences[first],
      sentence: first + 1,
    }));
    return result;
  }
  const ranked = vectors
    .map((v, i) => {
      const semantic = Math.max(0, cosineSimilarity(query, v));
      const matching = new Set(words[i].filter((t) => queryTerms.has(t)));
      const overlap = matching.size / Math.max(1, queryTerms.size);
      const weight = [...matching].reduce(
        (sum, word) => sum + Math.log(1 + sentences.length / counts.get(word)!),
        0,
      );
      const score =
        input.mode === "ask"
          ? 0.57 * semantic + 0.34 * overlap + 0.09 * Math.min(weight / 4, 1)
          : semantic + 0.035 / (1 + i);
      return { i, score, overlap, semantic };
    })
    .sort((a, b) => b.score - a.score);
  if (input.mode === "ask") {
    const best = ranked[0];
    const mixed = han.test(input.source) !== han.test(input.question);
    const crossLanguageMatch =
      mixed &&
      best &&
      best.semantic >= 0.46 &&
      best.semantic - (ranked[1]?.semantic ?? 0) >= 0.13;
    if (
      best &&
      (best.overlap >= 0.16 || best.semantic >= 0.62 || crossLanguageMatch)
    ) {
      const support = ranked
        .filter(
          (x) =>
            x.score >= best.score * 0.83 &&
            (x.overlap > 0 ||
              x.semantic >= 0.62 ||
              (x === best && crossLanguageMatch)),
        )
        .slice(0, 2);
      result.findings = support.map((x) => ({
        text: sentences[x.i],
        sentence: x.i + 1,
      }));
    }
    return result;
  }
  const chosen: number[] = [];
  const limit = Math.min(3, Math.max(1, Math.ceil(sentences.length / 3)));
  while (ranked.length && chosen.length < limit) {
    let bestIndex = 0,
      bestScore = -Infinity;
    ranked.forEach((item, pos) => {
      const redundancy = Math.max(
        0,
        ...chosen.map((j) => cosineSimilarity(vectors[j], vectors[item.i])),
      );
      const score = item.score - 0.4 * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = pos;
      }
    });
    chosen.push(ranked.splice(bestIndex, 1)[0].i);
  }
  result.findings = chosen
    .sort((a, b) => a - b)
    .map((i): Finding => ({ text: sentences[i], sentence: i + 1 }));
  return result;
}

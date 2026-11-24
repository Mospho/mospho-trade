import samples from "./samples.json" with { type: "json" };
export { samples };
export const modes = ["summary", "ask", "keywords"] as const;
export type Mode = (typeof modes)[number];
export const modeNames: Record<Mode, string> = {
  summary: "Summary",
  ask: "Text Q&A",
  keywords: "Keywords",
};
export const modeInstructions: Record<Mode, string> = {
  summary: "Extract the key sentences from your notes.",
  ask: "Find answers and supporting quotes in the text.",
  keywords: "Find key terms and see them in context.",
};
export interface LabInput {
  mode: Mode;
  source: string;
  question: string;
}
export interface Finding {
  text: string;
  sentence: number;
  label?: string;
}
export interface LabResult {
  mode: Mode;
  findings: Finding[];
  sentenceCount: number;
}

export function normalizeInput(raw: unknown): LabInput {
  const data = raw as Partial<LabInput> | null;
  if (!data || !modes.includes(data.mode as Mode))
    throw new Error("Choose one of the available tasks.");
  if (
    typeof data.source !== "string" ||
    data.source.trim().length < 10 ||
    data.source.length > 10000
  ) {
    throw new Error("Enter 10–10,000 characters of source text.");
  }
  const question =
    data.mode === "ask" && typeof data.question === "string"
      ? data.question.trim()
      : "";
  if (data.mode === "ask" && (question.length < 2 || question.length > 400)) {
    throw new Error("Enter a question of 2–400 characters.");
  }
  return { mode: data.mode as Mode, source: data.source.trim(), question };
}

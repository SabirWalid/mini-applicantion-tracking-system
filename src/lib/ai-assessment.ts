const stopwords = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "is",
  "are",
  "at",
  "be",
  "as",
  "by",
  "from",
  "that",
  "this",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

export function assessCv(jobDescription: string, cvText: string) {
  const jobTokens = tokenize(jobDescription);
  const cvTokenSet = new Set(tokenize(cvText));

  const uniqueJobTokens = Array.from(new Set(jobTokens));
  const matched = uniqueJobTokens.filter((token) => cvTokenSet.has(token));

  const score = uniqueJobTokens.length
    ? Math.min(100, Math.round((matched.length / uniqueJobTokens.length) * 100))
    : 50;

  const summary =
    matched.length > 0
      ? `Matched ${matched.length} relevant keywords: ${matched.slice(0, 12).join(", ")}.`
      : "No strong keyword overlap detected; manual review recommended.";

  return {
    score,
    summary,
  };
}

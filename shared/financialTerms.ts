const TERM_LABELS: Array<[RegExp, string]> = [
  [/\bstrong buy\b/gi, "적극 매수"],
  [/\bstrong sell\b/gi, "적극 매도"],
  [/\bnear fair value\b/gi, "적정가 근접"],
  [/\bfair value\b/gi, "적정가"],
  [/\boutperform\b/gi, "시장수익률 상회"],
  [/\bunderperform\b/gi, "시장수익률 하회"],
  [/\bovervalued\b/gi, "고평가"],
  [/\bundervalued\b/gi, "저평가"],
  [/\bbullish\b/gi, "강세"],
  [/\bbearish\b/gi, "약세"],
  [/\bbull\b/gi, "강세"],
  [/\bbear\b/gi, "약세"],
  [/\bneutral\b/gi, "중립"],
  [/\bpremium\b/gi, "프리미엄"],
  [/\bdiscount\b/gi, "할인"],
  [/\bbuy\b/gi, "매수"],
  [/\bsell\b/gi, "매도"],
  [/\bhold\b/gi, "보유"],
];

export function translateFinancialText(value: string) {
  return TERM_LABELS.reduce((text, [pattern, label]) => text.replace(pattern, label), value);
}

export function translateFinancialTerm(value: string | undefined | null) {
  if (!value) return "N/A";
  return translateFinancialText(value);
}

import twitterText from "twitter-text";

export interface TextValidationResult {
  valid: boolean;
  length: number;
  remaining: number;
  max: number;
  error?: string;
}

const MAX_WEIGHTED_LENGTH = 280;

/**
 * Validador oficial de texto do Twitter/X.
 * Conta URLs como 23 caracteres e normaliza caracteres Unicode / emojis compostos.
 */
export function validateTweetText(text: string): TextValidationResult {
  if (!text || text.trim().length === 0) {
    return {
      valid: false,
      length: 0,
      remaining: MAX_WEIGHTED_LENGTH,
      max: MAX_WEIGHTED_LENGTH,
      error: "O texto do tweet não pode ser vazio."
    };
  }

  // Utiliza a biblioteca oficial de contagem de peso do Twitter (twitter-text)
  const parsed = twitterText.parseTweet(text);

  return {
    valid: Boolean(parsed.valid),
    length: parsed.weightedLength,
    remaining: MAX_WEIGHTED_LENGTH - parsed.weightedLength,
    max: MAX_WEIGHTED_LENGTH,
    error: parsed.valid ? undefined : `O texto excede o limite de 280 caracteres (${parsed.weightedLength}/280).`
  };
}

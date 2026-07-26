export const MAX_QUERY_CHARS = Number(process.env.NEXT_PUBLIC_MAX_QUERY_CHARS || 500);

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  charCount: number;
}

export function validateQuery(text: string): ValidationResult {
  const trimmed = (text || '').trim();
  const charCount = trimmed.length;
  
  if (charCount === 0) {
    return {
      isValid: false,
      message: 'Problem description cannot be empty.',
      charCount,
    };
  }
  
  if (charCount > MAX_QUERY_CHARS) {
    return {
      isValid: false,
      message: `Your query is too long (${charCount}/${MAX_QUERY_CHARS} characters). Please refine and shorten your description so we can cluster it efficiently.`,
      charCount,
    };
  }
  
  return {
    isValid: true,
    charCount,
  };
}

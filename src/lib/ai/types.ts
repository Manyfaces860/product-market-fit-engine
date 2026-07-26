export type LLMProvider = 'openai' | 'anthropic' | 'vertexai' | 'nvidia' | 'cerebras' | 'openrouter';
export type EmbeddingProvider = 'openai' | 'vertexai' | 'nvidia' | 'openrouter' | 'local-fallback';

export interface ClassificationResult {
  category: string;         // e.g. "housing-landlord"
  categoryLabel: string;    // e.g. "Housing & Landlord Issues"
  categoryDescription: string; // e.g. "Problems related to renting, landlords, leases, and home maintenance"
  canonicalText: string;    // e.g. "Landlord refuses to repair heater or heating system"
  isValid: boolean;          // true if it is a valid, product/service-addressable problem; false if gibberish/spam/too personal
  rejectionReason?: string;  // present if isValid is false, explaining why
}

export interface AIServiceConfig {
  llmProvider: LLMProvider;
  embeddingProvider: EmbeddingProvider;
  
  // Keys
  openaiApiKey?: string;
  anthropicApiKey?: string;
  nvidiaApiKey?: string;
  cerebrasApiKey?: string;
  openrouterApiKey?: string;
  
  // Models
  openaiCompletionModel?: string;
  openaiEmbeddingModel?: string;
  anthropicCompletionModel?: string;
  nvidiaCompletionModel?: string;
  nvidiaEmbeddingModel?: string;
  cerebrasCompletionModel?: string;
  openrouterCompletionModel?: string;
  openrouterEmbeddingModel?: string;
  
  // Vertex
  vertexProjectId?: string;
  vertexLocation?: string;
  vertexApiEndpoint?: string;
  vertexServiceAccountKeyJson?: string;
}

export interface IEmbeddingService {
  getEmbedding(text: string): Promise<number[]>;
}

export interface ILLMService {
  classifyProblem(text: string, existingCategories: { id: string; label: string; description: string }[]): Promise<ClassificationResult>;
}

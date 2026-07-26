import { AIServiceConfig, LLMProvider, EmbeddingProvider } from './types';

export function getAIServiceConfig(): AIServiceConfig {
  return {
    llmProvider: (process.env.LLM_PROVIDER as LLMProvider) || 'openai',
    embeddingProvider: (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    nvidiaApiKey: process.env.NVIDIA_API_KEY,
    cerebrasApiKey: process.env.CEREBRAS_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    
    // Models
    openaiCompletionModel: process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini',
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    anthropicCompletionModel: process.env.ANTHROPIC_COMPLETION_MODEL || 'claude-3-5-haiku-20241022',
    nvidiaCompletionModel: process.env.NVIDIA_COMPLETION_MODEL || 'meta/llama-3.1-8b-instruct',
    nvidiaEmbeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/llama-3.2-nv-embedqc-1',
    cerebrasCompletionModel: process.env.CEREBRAS_COMPLETION_MODEL || 'llama3.1-8b',
    openrouterCompletionModel: process.env.OPENROUTER_COMPLETION_MODEL || 'meta-llama/llama-3.1-8b-instruct',
    openrouterEmbeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small',
    
    // Vertex AI (GCP)
    vertexProjectId: process.env.VERTEX_PROJECT_ID,
    vertexLocation: process.env.VERTEX_LOCATION || 'us-central1',
    vertexApiEndpoint: process.env.VERTEX_API_ENDPOINT || 'us-central1-aiplatform.googleapis.com',
    vertexServiceAccountKeyJson: process.env.VERTEX_SERVICE_ACCOUNT_KEY_JSON,
  };
}

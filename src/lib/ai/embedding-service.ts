import { getAIServiceConfig } from './config';
import { IEmbeddingService } from './types';
import OpenAI from 'openai';

export class EmbeddingService implements IEmbeddingService {
  private config = getAIServiceConfig();

  async getEmbedding(text: string): Promise<number[]> {
    const provider = this.config.embeddingProvider;

    switch (provider) {
      case 'openai':
        return this.getOpenAIEmbedding(text);
      case 'nvidia':
        return this.getNvidiaEmbedding(text);
      case 'openrouter':
        return this.getOpenRouterEmbedding(text);
      case 'vertexai':
        return this.getVertexAIEmbedding(text);
      case 'local-fallback':
      default:
        console.warn(`[EmbeddingService] Using local fallback embedding for text: "${text.substring(0, 30)}..."`);
        return this.getLocalFallbackEmbedding(text);
    }
  }

  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key is missing. Please set OPENAI_API_KEY.');
    }
    const openai = new OpenAI({ apiKey: this.config.openaiApiKey });
    const response = await openai.embeddings.create({
      model: this.config.openaiEmbeddingModel || 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return response.data[0].embedding;
  }

  private async getNvidiaEmbedding(text: string): Promise<number[]> {
    if (!this.config.nvidiaApiKey) {
      throw new Error('NVIDIA API key is missing. Please set NVIDIA_API_KEY.');
    }
    const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.nvidiaApiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: this.config.nvidiaEmbeddingModel || 'nvidia/llama-3.2-nv-embedqc-1',
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA NIM embedding failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async getOpenRouterEmbedding(text: string): Promise<number[]> {
    if (!this.config.openrouterApiKey) {
      throw new Error('OpenRouter API key is missing. Please set OPENROUTER_API_KEY.');
    }
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openrouterApiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.config.openrouterEmbeddingModel || 'openai/text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter embedding failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async getVertexAIEmbedding(text: string): Promise<number[]> {
    // Vertex AI call. Users can set up Google credentials.
    // Vertex AI REST call for multimodal or text embeddings:
    // POST https://{endpoint}/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:predict
    const projectId = this.config.vertexProjectId;
    const location = this.config.vertexLocation || 'us-central1';
    const endpoint = this.config.vertexApiEndpoint || `${location}-aiplatform.googleapis.com`;
    
    if (!projectId) {
      throw new Error('Vertex Project ID is missing. Please set VERTEX_PROJECT_ID.');
    }

    // Try to get token from SERVICE_ACCOUNT_KEY or fallback to custom environment tokens
    let accessToken = process.env.GCP_ACCESS_TOKEN || '';

    // If a service account JSON is provided, normally we would generate an OAuth token.
    // For local flexibility, we allow passing a pre-configured GCP_ACCESS_TOKEN, or we can look up ADC.
    if (!accessToken && this.config.vertexServiceAccountKeyJson) {
      try {
        const sa = JSON.parse(this.config.vertexServiceAccountKeyJson);
        // User said: "I will setup the auth as I have that"
        // We will document and use sa.private_key if needed, or simply pass headers as set up by the user.
        console.log('[VertexAI] Service Account JSON provided.');
      } catch (err) {
        console.error('Failed to parse Vertex Service Account Key JSON:', err);
      }
    }

    const url = `https://${endpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instances: [{ content: text }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI embedding failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    // Vertex returns embeddings in predictions[0].values
    return data.predictions[0].values;
  }

  // Generates a deterministic high-dimensional embedding vector (1536d) from the input string.
  // Useful for local testing/development without wasting API tokens or when keys aren't configured.
  private getLocalFallbackEmbedding(text: string): number[] {
    const dimensions = 1536;
    const embedding: number[] = new Array(dimensions).fill(0);
    
    // Hash the string to generate deterministic pseudo-random values
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    let magnitude = 0;
    for (let i = 0; i < dimensions; i++) {
      const val = Math.sin(hash + i) * Math.cos((hash * (i + 1)) / 100);
      embedding[i] = val;
      magnitude += val * val;
    }

    // Normalize to unit vector
    magnitude = Math.sqrt(magnitude);
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude || 1;
    }

    return embedding;
  }
}
export const embeddingService = new EmbeddingService();

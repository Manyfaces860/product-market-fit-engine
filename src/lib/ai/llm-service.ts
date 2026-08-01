import { getAIServiceConfig } from './config';
import { ILLMService, ClassificationResult } from './types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export class LLMService implements ILLMService {
  private config = getAIServiceConfig();

  async classifyProblem(
    text: string,
    existingCategories: { id: string; label: string; description: string }[]
  ): Promise<ClassificationResult> {
    const provider = this.config.llmProvider;

    const systemPrompt = `You are an AI classification assistant for a platform called NeedBoard (Problem-Market Fit discovery engine for builders, developers, and founders).
Your job is to read an input user frustration or problem, validate it, classify it, and generate a clean, generalized, representative "canonical" description.

NeedBoard's Mission:
We help developers, software engineers, and hardware builders find real-world, commercializable pain points (in software, developer experience, hardware, digital operations, physical gadgets, etc.) that they can solve by building software products (SaaS), physical hardware, or operational tools.

Validation Rules:
You MUST determine if the input is a valid, understandable, real-world, product-addressable problem.
- Mark "isValid": true ONLY if the input is a meaningful statement describing a real-world friction point that could theoretically be solved by a business, a software tool, a physical product, a developer utility, or a commercial service.
- Mark "isValid": false if the input is:
  1. Gibberish / Spam / Unreadable: Random strings of letters (e.g., "asdfafsasf", "qwertyuiop"), cryptographic keys or hashes, single letters, random lists of numbers, or code snippets with zero context.
  2. Too Personal / Interpersonal: Interpersonal relationship issues (e.g., "my boyfriend didn't text me back") or raw emotional venting with no business product angle.
  3. Existential / Philosophical: (e.g., "why does the universe exist").
  4. Completely unsolvable by products/services: (e.g., general weather venting like "I hate when it rains").

Existing Categories:
${existingCategories.map((c) => `- "${c.id}": ${c.label} (${c.description})`).join('\n')}

Classification Instructions (Only applicable if isValid is true):
1. Determine if the problem fits into one of the existing categories.
2. If it fits, use that existing category ID, label, and description.
3. If it does NOT fit any existing category well, propose a NEW category suitable for a builder or developer target. The new category ID should be lowercase, kebab-case (e.g., "developer-tools", "smart-home", "ecommerce-ops", "micro-saas").
4. Create a clean, concise, generalized "canonicalText" that represents this problem. It should be a single, well-written sentence that multiple people with similar issues would agree describes their general problem (e.g., instead of "my Webpack config takes forever to compile," use "Slow hot-reload compilation times when building large frontend codebases").

Response Format:
You MUST respond with a single, valid JSON object and absolutely nothing else. No markdown wrappers (like \`\`\`json), no preamble, no conversational filler.
JSON keys:
- "isValid": boolean (true if valid and product/service solvable; false if gibberish, spam, too personal, or non-commercializable)
- "rejectionReason": string (Only provide this if isValid is false; explain why it was rejected in a clear, friendly, single sentence)
- "category": string (the selected or proposed category ID; use empty string "" if isValid is false)
- "categoryLabel": string (the selected or proposed category label; use empty string "" if isValid is false)
- "categoryDescription": string (the selected or proposed category description; use empty string "" if isValid is false)
- "canonicalText": string (the clean, generalized canonical representative text; use empty string "" if isValid is false)

Example response for VALID input:
{
  "isValid": true,
  "category": "software-devtools",
  "categoryLabel": "Software & Developer Tools",
  "categoryDescription": "Problems related to developer experience, API integrations, build tools, and cloud infrastructure.",
  "canonicalText": "Slow hot-reload compilation times when modifying styling assets in monorepos"
}

Example response for INVALID input:
{
  "isValid": false,
  "rejectionReason": "Input appears to be meaningless gibberish or spam.",
  "category": "",
  "categoryLabel": "",
  "categoryDescription": "",
  "canonicalText": ""
}`;

    const userPrompt = `User Problem Submission: "${text}"`;

    let responseText = '';

    switch (provider) {
      case 'openai':
        responseText = await this.callOpenAI(systemPrompt, userPrompt);
        break;
      case 'anthropic':
        responseText = await this.callAnthropic(systemPrompt, userPrompt);
        break;
      case 'nvidia':
        responseText = await this.callNvidia(systemPrompt, userPrompt);
        break;
      case 'cerebras':
        responseText = await this.callCerebras(systemPrompt, userPrompt);
        break;
      case 'openrouter':
        responseText = await this.callOpenRouter(systemPrompt, userPrompt);
        break;
      case 'vertexai':
        responseText = await this.callVertexAI(systemPrompt, userPrompt);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    try {
      // Clean up markdown block wraps if the LLM didn't listen
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      const result: ClassificationResult = JSON.parse(cleanText);
      return result;
    } catch (err) {
      console.error('Failed to parse LLM JSON classification result. Raw output:', responseText);
      throw new Error(`LLM classification output was not valid JSON: ${err}`);
    }
  }

  private async callOpenAI(system: string, user: string): Promise<string> {
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key is missing.');
    }
    const openai = new OpenAI({ apiKey: this.config.openaiApiKey });
    const response = await openai.chat.completions.create({
      model: this.config.openaiCompletionModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content || '';
  }

  private async callAnthropic(system: string, user: string): Promise<string> {
    if (!this.config.anthropicApiKey) {
      throw new Error('Anthropic API key is missing.');
    }
    const anthropic = new Anthropic({ apiKey: this.config.anthropicApiKey });
    const response = await anthropic.messages.create({
      model: this.config.anthropicCompletionModel || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.2,
    });
    // Anthropic returns array of block contents, we take the text block
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }

  private async callNvidia(system: string, user: string): Promise<string> {
    if (!this.config.nvidiaApiKey) {
      throw new Error('NVIDIA API key is missing.');
    }
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.nvidiaApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.nvidiaCompletionModel || 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA NIM completion failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  }

  private async callCerebras(system: string, user: string): Promise<string> {
    if (!this.config.cerebrasApiKey) {
      throw new Error('Cerebras API key is missing.');
    }
    // Cerebras supports OpenAI-compatible API format
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.cerebrasApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.cerebrasCompletionModel || 'llama3.1-8b',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cerebras completion failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  }

  private async callOpenRouter(system: string, user: string): Promise<string> {
    if (!this.config.openrouterApiKey) {
      throw new Error('OpenRouter API key is missing.');
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openrouterApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.openrouterCompletionModel || 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 1024
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter completion failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  }

  private async callVertexAI(system: string, user: string): Promise<string> {
    const projectId = this.config.vertexProjectId;
    const location = this.config.vertexLocation || 'us-central1';
    const endpoint = this.config.vertexApiEndpoint || `${location}-aiplatform.googleapis.com`;

    if (!projectId) {
      throw new Error('Vertex Project ID is missing. Please set VERTEX_PROJECT_ID.');
    }

    let accessToken = process.env.GCP_ACCESS_TOKEN || '';

    // Vertex AI REST call for Gemni Chat Completions:
    // POST https://{endpoint}/v1/projects/{project}/locations/{location}/publishers/google/models/gemini-1.5-flash:generateContent
    const url = `https://${endpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-1.5-flash:generateContent`;

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
        contents: [
          {
            role: 'user',
            parts: [{ text: `${system}\n\n${user}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI completion failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text || '';
  }
}
export const llmService = new LLMService();

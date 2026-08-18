import { getAIServiceConfig } from './config';
import { ILLMService, ClassificationResult } from './types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import staticCategories, { focusedCategories } from './static-categories';

export class LLMService implements ILLMService {
  private config = getAIServiceConfig();

  async classifyProblem(
    text: string,
    existingCategories: { id: string; label: string; description: string }[]
  ): Promise<ClassificationResult> {
    if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
      const lower = text.toLowerCase();
      if (lower.includes('asdfghjkl') || lower.includes('gibberish')) {
        return {
          isValid: false,
          rejectionReason: 'Input appears to be meaningless gibberish or spam.',
          category: '',
          categoryLabel: '',
          categoryDescription: '',
          canonicalText: ''
        };
      }
      if (lower.includes('cookies') || lower.includes('love cookies')) {
        return {
          isValid: false,
          rejectionReason: 'Input is out of scope. Please submit a software or product-solvable issue.',
          category: '',
          categoryLabel: '',
          categoryDescription: '',
          canonicalText: ''
        };
      }
      return {
        isValid: true,
        category: 'software-devtools',
        categoryLabel: 'Developer Tools & DX',
        categoryDescription: 'Problems related to developer experience, API integrations, build tools, and cloud infrastructure.',
        canonicalText: text.length > 50 ? text : `Generalized problem: ${text}`
      };
    }

    const provider = this.config.llmProvider;

    // 🚀 Only the currently-focused categories are open for LLM classification.
    // Anything that does not fit these is rejected as out-of-scope for now.
    const activeCategories = focusedCategories.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
    }));
    const activeCategoryIds = activeCategories.map(c => c.id);

    const systemPrompt = `You are an AI classification assistant for a platform called NeedBoard (Problem-Market Fit discovery engine for builders, developers, and founders).
Your job is to read an input user frustration or problem, validate it, classify it, and generate a clean, generalized, representative "canonical" description.

NeedBoard's Mission:
We help developers, software engineers, and hardware builders find real-world, commercializable pain points (in software, developer experience, hardware, digital operations, physical gadgets, etc.) that they can solve by building software products (SaaS), physical hardware, or operational tools.

CURRENT FOCUS:
Right now NeedBoard is ONLY collecting problems that fit one of these two active categories:
${activeCategories.map((c) => `- "${c.id}": ${c.label} (${c.description})`).join('\n')}

Validation Rules:
You MUST determine if the input is a valid, understandable, real-world, product-addressable problem that fits ONE of the two active categories above.
- Mark "isValid": true ONLY if the input describes a friction point that clearly fits Developer Tools & DX or SaaS & B2B Productivity.
- Mark "isValid": false if the input is:
  1. Gibberish / Spam / Unreadable: Random strings of letters (e.g., "asdfafsasf", "qwertyuiop"), cryptographic keys or hashes, single letters, random lists of numbers, or code snippets with zero context.
  2. Too Personal / Interpersonal: Interpersonal relationship issues (e.g., "my boyfriend didn't text me back") or raw emotional venting with no business product angle.
  3. Existential / Philosophical: (e.g., "why does the universe exist").
  4. Completely unsolvable by products/services: (e.g., general weather venting like "I hate when it rains").
  5. OUT OF SCOPE FOR NOW: Any problem that would belong to a category we are not yet collecting (hardware, e-commerce, fintech, HR, health, education, real estate, etc.). Do NOT propose new categories — reject these with a friendly out-of-scope reason.

Classification Instructions (Only applicable if isValid is true):
1. Determine if the problem fits "software-devtools" or "software-saas".
2. Use that category's ID, label, and description exactly as listed above.
3. Create a clean, concise, generalized "canonicalText" that represents this problem. It should be a single, well-written sentence that multiple people with similar issues would agree describes their general problem (e.g., instead of "my Webpack config takes forever to compile," use "Slow hot-reload compilation times when building large frontend codebases").

Response Format:
You MUST respond with a single, valid JSON object and absolutely nothing else. No markdown wrappers (like \`\`\`json), no preamble, no conversational filler.
JSON keys:
- "isValid": boolean (true if valid and fits one of the two active categories; false otherwise)
- "rejectionReason": string (Only provide this if isValid is false; explain why it was rejected in a clear, friendly, single sentence)
- "category": string (one of the two active category IDs; use empty string "" if isValid is false)
- "categoryLabel": string (the active category label; use empty string "" if isValid is false)
- "categoryDescription": string (the active category description; use empty string "" if isValid is false)
- "canonicalText": string (the clean, generalized canonical representative text; use empty string "" if isValid is false)

Example response for VALID input:
{
  "isValid": true,
  "category": "software-devtools",
  "categoryLabel": "Developer Tools & DX",
  "categoryDescription": "Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.",
  "canonicalText": "Slow hot-reload compilation times when modifying styling assets in monorepos"
}

Example response for INVALID (out of scope) input:
{
  "isValid": false,
  "rejectionReason": "That sounds like a hardware problem — we're only collecting developer tools and SaaS productivity issues right now.",
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

      // 🛡️ Guard: never classify into a category outside our current focus
      if (result.isValid && !activeCategoryIds.includes(result.category)) {
        const fallback = staticCategories.find(c => c.id === result.category);
        return {
          isValid: false,
          rejectionReason: `We're only collecting problems in Developer Tools & DX and SaaS & B2B Productivity right now${fallback ? ` — "${fallback.label}" is coming soon` : ''}.`,
          category: '',
          categoryLabel: '',
          categoryDescription: '',
          canonicalText: ''
        };
      }

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

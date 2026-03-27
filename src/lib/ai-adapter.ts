import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { LanguageModel } from 'ai';

interface AdapterOptions {
  preferFastModel?: boolean;
}

export function getPromptTemplate(request: Request): string {
  return request.headers.get('x-ai-prompt-template')?.trim() || '';
}

export function getAiAdapter(request: Request, options?: AdapterOptions): LanguageModel {
  const provider = request.headers.get('x-ai-provider') || 'openai';
  const baseUrl = request.headers.get('x-ai-base-url') || undefined;
  const apiKey = request.headers.get('x-ai-api-key');
  const modelName = request.headers.get('x-ai-model') || 'gpt-4o';
  void options;

  if (!apiKey) {
    throw new Error('API Key is missing. Please configure your AI settings in the UI.');
  }

  // Use the Vercel AI SDK instances tailored to each provider
  switch (provider) {
    case 'deepseek': {
      const deepseek = createDeepSeek({
        apiKey,
        baseURL: baseUrl || 'https://api.deepseek.com/v1',
      });
      return deepseek(modelName);
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl || undefined,
      });
      return google(modelName);
    }
    case 'claude': {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl || undefined,
      });
      return anthropic(modelName);
    }
    case 'openai':
    case 'custom':
    default: {
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl || undefined, // For custom, baseUrl points to standard OpenAI compatible endpoints
      });
      return openai(modelName);
    }
  }
}

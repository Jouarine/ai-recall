import { useAiSettings } from '@/store/ai-settings';

/**
 * Custom fetch client that automatically attaches the user's local AI API configurations
 * dynamically via API headers on every backend request.
 */
export const apiClient = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const { settings, isConfigured } = useAiSettings.getState();
    const headers = new Headers(init?.headers || {});

    // Only attach settings if the user has provided an API key. 
    // This allows the backend adapter to uniformly process them.
    if (isConfigured()) {
      headers.set('x-ai-provider', settings.provider);
      headers.set('x-ai-api-key', settings.apiKey);
      headers.set('x-ai-model', settings.modelName);
      if (settings.promptTemplate?.trim()) {
        headers.set('x-ai-prompt-template', settings.promptTemplate.trim());
      }
      if (settings.baseUrl) {
        headers.set('x-ai-base-url', settings.baseUrl);
      }
    }

    return fetch(input, {
      ...init,
      headers,
    });
  }
};

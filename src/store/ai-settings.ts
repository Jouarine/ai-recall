import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AiProvider = 'openai' | 'gemini' | 'deepseek' | 'claude' | 'custom'

export interface AiSettings {
  provider: AiProvider
  baseUrl: string
  apiKey: string
  modelName: string
  promptTemplate: string
  extraPrompt: string
}

interface AiSettingsStore {
  settings: AiSettings
  updateSettings: (settings: Partial<AiSettings>) => void
  isConfigured: () => boolean
}

export const useAiSettings = create<AiSettingsStore>()(
  persist(
    (set, get) => ({
      settings: {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        modelName: 'deepseek-reasoner',
        promptTemplate: '',
        extraPrompt: '',
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      isConfigured: () => {
        const s = get().settings;
        return s.apiKey.trim().length > 0;
      }
    }),
    {
      name: 'ai-recall-settings',
    }
  )
)

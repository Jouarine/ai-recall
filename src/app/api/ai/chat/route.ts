import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { appendAiLog } from '@/lib/ai-debug-log';

export const maxDuration = 30;

const getInputPreview = (messages: UIMessage[]) =>
  messages.map((msg) => ({
    role: msg.role,
    text: msg.parts
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('')
      .trim(),
  }));

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const systemBase =
      '你是一个温和、耐心、循循善诱的 AI 学习导师。如果用户提供了【当前学习段落】和【我的错误回答记录】，请指出误区并顺着原文知识点引导，不要直接给标准答案。多用类比和简明语言，回答精炼。';
    const systemPrompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}${systemBase}`;

    let textOutput = '';
    let reasoningOutput = '';

    const result = streamText({
      model,
      messages: await convertToModelMessages(messages),
      system: systemPrompt,
      onChunk: async ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          textOutput += chunk.text;
        }
        if (chunk.type === 'reasoning-delta') {
          reasoningOutput += chunk.text;
        }
      },
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      onFinish: async () => {
        const mergedOutput = reasoningOutput.trim()
          ? `[reasoning]\n${reasoningOutput}\n\n[answer]\n${textOutput}`
          : textOutput;

        await appendAiLog({
          route: '/api/ai/chat',
          input: getInputPreview(messages),
          prompt: systemPrompt,
          output: mergedOutput,
        }).catch(() => null);
      },
      onError: (error: unknown) => {
        void appendAiLog({
          route: '/api/ai/chat',
          input: getInputPreview(messages),
          prompt: systemPrompt,
          output: textOutput,
          error: error instanceof Error ? error.message : String(error),
        }).catch(() => null);
        return error instanceof Error ? error.message : 'Chat stream failed';
      },
    });
  } catch (error: unknown) {
    console.error('[AI] chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

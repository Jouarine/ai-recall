export const runtime = 'nodejs';

import { z } from 'zod';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { NextResponse } from 'next/server';
import { generateJsonWithSchema } from '@/lib/ai-json';

const schema = z.object({
  question: z.string(),
  referenceAnswer: z.string(),
  options: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const { originalText, questionType = 'short_answer', additionalPrompt = '' } = await req.json();

    if (!originalText) {
      return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);
    const normalizedType = String(questionType).toLowerCase();

    const typeInstruction =
      normalizedType === 'choice'
        ? '生成 1 道四选一选择题，必须包含 options(4项) 和 referenceAnswer。'
        : normalizedType === 'thinking'
          ? '生成 1 道思考题，强调分析与推理，并给出简明参考答案。'
          : normalizedType === 'application'
            ? '生成 1 道应用题，强调情境应用，并给出参考答案。'
            : '生成 1 道简答题，并给出参考答案。';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是出题助手。请基于原文生成题目，并严格输出 JSON。
${typeInstruction}
附加要求：${additionalPrompt || '无'}

原文：
${originalText}
`;

    const result = await generateJsonWithSchema({
      model,
      schema,
      prompt,
      temperature: 0.2,
      maxRetries: 2,
      debugRoute: '/api/ai/generate-qa',
      debugInput: {
        questionType: normalizedType,
        originalTextLength: String(originalText).length,
        hasAdditionalPrompt: Boolean(String(additionalPrompt || '').trim()),
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] QA generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

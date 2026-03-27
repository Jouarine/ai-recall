export const runtime = 'nodejs';

import { z } from 'zod';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { NextResponse } from 'next/server';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';

const schema = z.object({
  sentence: z.string().describe('Sentence with placeholders like {{blank_0}}'),
  answers: nonEmptyStringArray.describe('Answers ordered by placeholder index'),
});

export async function POST(req: Request) {
  try {
    const { originalText, usedBlanksHistory = [], additionalPrompt = '' } = await req.json();

    if (!originalText) {
      return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const historyPrompt =
      Array.isArray(usedBlanksHistory) && usedBlanksHistory.length > 0
        ? `以下答案已用过，请避免重复：${usedBlanksHistory.join('、')}`
        : '请生成 1-3 个高价值空，覆盖关键概念。';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是出题助手。请根据给定原文生成一道填空题，并严格输出 JSON。
要求：
1. sentence 中用 {{blank_0}}、{{blank_1}} 这类占位符表示空。
2. answers 按占位符顺序给出标准答案。
3. 不要输出解释文本。
${historyPrompt}
附加要求：${additionalPrompt || '无'}

原文：
${originalText}
`;

    const result = await generateJsonWithSchema({
      model,
      schema,
      prompt,
      temperature: 0.5,
      maxRetries: 2,
      debugRoute: '/api/ai/generate-cloze',
      debugInput: {
        originalTextLength: String(originalText).length,
        usedBlanksHistoryCount: Array.isArray(usedBlanksHistory) ? usedBlanksHistory.length : 0,
        hasAdditionalPrompt: Boolean(String(additionalPrompt || '').trim()),
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] cloze generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

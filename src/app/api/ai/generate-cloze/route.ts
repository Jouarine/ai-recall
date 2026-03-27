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
        ? `不要再次挖空这些词：${usedBlanksHistory.join('、')}`
        : '请选择 1-3 个核心概念挖空。';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是严格的填空题出题助手。
请基于下面原文生成一道高质量填空题，不能改变事实。
${historyPrompt}
附加提示词：${additionalPrompt || '无'}。

输出要求：
1. sentence 使用 {{blank_0}}、{{blank_1}} 这种占位符。
2. answers 按占位符顺序返回。
3. 题目尽量覆盖核心概念。

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

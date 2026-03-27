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
        ? '请生成 1 道选择题，附 4 个选项（options），并给出唯一正确答案 referenceAnswer。'
        : normalizedType === 'thinking'
          ? '请生成 1 道思考题，强调观点与推理，并给出参考作答方向。'
          : normalizedType === 'application'
            ? '请生成 1 道应用题，强调将知识用于场景，并给出参考答案。'
            : '请生成 1 道简答题，并给出参考答案。';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是学习辅导老师。
${typeInstruction}
题目必须基于原文，不得编造。
附加提示词：${additionalPrompt || '无'}。

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

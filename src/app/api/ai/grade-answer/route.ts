export const runtime = 'nodejs';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { generateJsonWithSchema } from '@/lib/ai-json';

const schema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
  advice: z.string(),
});

export async function POST(req: Request) {
  try {
    const {
      questionType,
      question,
      referenceAnswer,
      userAnswer,
      maxScore = 10,
      additionalPrompt = '',
    } = await req.json();

    if (!question || !userAnswer) {
      return NextResponse.json({ error: 'question and userAnswer are required' }, { status: 400 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是阅卷助手。请根据题目、参考答案和学生答案进行评分。
题型：${questionType || 'short_answer'}
满分：${maxScore}
题目：${question}
参考答案：${referenceAnswer || '无'}
学生答案：${userAnswer}
附加要求：${additionalPrompt || '无'}

请严格输出 JSON：
1. score：0-${maxScore} 的数字分数
2. feedback：简短评价（指出关键得失）
3. advice：改进建议（可执行）
`;

    const result = await generateJsonWithSchema({
      model,
      schema,
      prompt,
      temperature: 0.2,
      maxRetries: 2,
      debugRoute: '/api/ai/grade-answer',
      debugInput: {
        questionType,
        questionLength: String(question).length,
        userAnswerLength: String(userAnswer).length,
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] grade answer error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

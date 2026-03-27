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
你是严格评分助手。请对用户答案进行评分与反馈。
评分范围：0-${maxScore} 分。
题型：${questionType || 'short_answer'}
题目：${question}
参考答案：${referenceAnswer || '无'}
用户答案：${userAnswer}
附加要求：${additionalPrompt || '无'}

输出要求：
1. score：0-${maxScore} 的数字，可保留一位小数。
2. feedback：说明得分依据（简洁）。
3. advice：给出下一步改进建议（可执行）。
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

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
You are a strict grading assistant.
Task: Grade the student's answer against the question and reference answer.

Return JSON only. No markdown, no explanations.
Required schema:
{
  "score": 0,
  "feedback": "...",
  "advice": "..."
}

Rules:
1. score must be a number in [0, ${maxScore}].
2. feedback should state strengths and mistakes briefly.
3. advice should provide actionable next steps.
4. Keep output concise and objective.

Example output:
{
  "score": 7,
  "feedback": "Core idea is correct, but key detail about time complexity is missing.",
  "advice": "Review the proof for why binary search halves the search space each step."
}

Input:
- questionType: ${questionType || 'short_answer'}
- maxScore: ${maxScore}
- question: ${question}
- referenceAnswer: ${referenceAnswer || 'None'}
- userAnswer: ${userAnswer}
- additionalInstruction: ${additionalPrompt || 'None'}
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
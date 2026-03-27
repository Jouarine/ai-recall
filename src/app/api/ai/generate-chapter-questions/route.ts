export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';

const chapterQuestionSchema = z.object({
  questions: z.array(
    z.object({
      knowledgePointId: z.string(),
      sentence: z.string(),
      answers: nonEmptyStringArray,
    })
  ),
});

const singleQuestionSchema = z.object({
  sentence: z.string(),
  answers: nonEmptyStringArray,
});

type KnowledgePointLite = {
  id: string;
  name: string;
  originalText: string;
};

async function generateSingleQuestion(
  model: ReturnType<typeof getAiAdapter>,
  promptTemplate: string,
  knowledgePoint: KnowledgePointLite
) {
  const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict question generator.
Task: Generate exactly one cloze question from the input knowledge point.

Output rules:
1. Return JSON only, no markdown, no explanation.
2. Use this schema exactly:
{
  "sentence": "... {{blank_0}} ...",
  "answers": ["..."]
}
3. sentence must include at least one placeholder like {{blank_0}}.
4. answers must match placeholder order.
5. Keep wording grounded in source text.

Example output:
{
  "sentence": "TCP uses {{blank_0}} to ensure reliable delivery.",
  "answers": ["sequence numbers"]
}

Knowledge point name:
${knowledgePoint.name}
Source text:
${knowledgePoint.originalText}
`;

  return generateJsonWithSchema({
    model,
    schema: singleQuestionSchema,
    prompt,
    temperature: 0.35,
    maxRetries: 2,
    debugRoute: '/api/ai/generate-chapter-questions#single-fallback',
    debugInput: { knowledgePointId: knowledgePoint.id, knowledgePointName: knowledgePoint.name },
  });
}

export async function POST(req: Request) {
  try {
    const { chapterId } = await req.json();

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId is required' }, { status: 400 });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        knowledgePoints: {
          include: { questions: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const pendingKnowledgePoints = chapter.knowledgePoints.filter((kp) => (kp.questions?.length || 0) === 0);
    if (pendingKnowledgePoints.length === 0) {
      return NextResponse.json({ createdCount: 0, skippedCount: chapter.knowledgePoints.length });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const batchPrompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict question generator.
Task: Generate one cloze question for EACH knowledge point below.

Output rules:
1. Return JSON only, no markdown, no explanation.
2. Use this schema exactly:
{
  "questions": [
    {
      "knowledgePointId": "...",
      "sentence": "... {{blank_0}} ...",
      "answers": ["..."]
    }
  ]
}
3. Every knowledgePointId in input must appear exactly once in output.
4. sentence must include placeholder(s) {{blank_n}}.
5. answers order must match placeholders.
6. Do not fabricate facts not present in source text.

Example output:
{
  "questions": [
    {
      "knowledgePointId": "kp_1",
      "sentence": "DNS usually uses port {{blank_0}}.",
      "answers": ["53"]
    }
  ]
}

Knowledge points input:
${JSON.stringify(
  pendingKnowledgePoints.map((kp) => ({
    knowledgePointId: kp.id,
    name: kp.name,
    originalText: kp.originalText,
  }))
)}
`;

    const batchResult = await generateJsonWithSchema({
      model,
      schema: chapterQuestionSchema,
      prompt: batchPrompt,
      temperature: 0.35,
      maxRetries: 1,
      debugRoute: '/api/ai/generate-chapter-questions#batch',
      debugInput: { chapterId, pendingKnowledgePointCount: pendingKnowledgePoints.length },
    });

    const pendingMap = new Map(pendingKnowledgePoints.map((kp) => [kp.id, kp]));
    const questionMap = new Map<string, { sentence: string; answers: string[] }>();

    for (const item of batchResult.questions || []) {
      if (!pendingMap.has(item.knowledgePointId)) continue;
      if (!item.sentence || !item.answers?.length) continue;
      if (!questionMap.has(item.knowledgePointId)) {
        questionMap.set(item.knowledgePointId, { sentence: item.sentence, answers: item.answers });
      }
    }

    const missing = pendingKnowledgePoints.filter((kp) => !questionMap.has(kp.id));
    for (const kp of missing) {
      try {
        const single = await generateSingleQuestion(model, promptTemplate, {
          id: kp.id,
          name: kp.name,
          originalText: kp.originalText,
        });
        questionMap.set(kp.id, single);
      } catch (error) {
        console.error('[AI] fallback single question failed:', kp.id, error);
      }
    }

    const toCreate = pendingKnowledgePoints
      .map((kp) => {
        const generated = questionMap.get(kp.id);
        if (!generated) return null;

        const answers = generated.answers.filter(Boolean);
        const blanksData = answers.map((answer, index) => ({ id: `b${index}`, answer, index }));
        if (!generated.sentence || blanksData.length === 0) return null;

        return {
          knowledgePointId: kp.id,
          type: 'cloze',
          blanksData: JSON.stringify(blanksData),
          usedBlanksHistory: JSON.stringify(answers),
          displayText: generated.sentence,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (toCreate.length > 0) {
      await prisma.$transaction(toCreate.map((data) => prisma.question.create({ data })));
    }

    return NextResponse.json({
      createdCount: toCreate.length,
      skippedCount: chapter.knowledgePoints.length - toCreate.length,
      expectedCount: pendingKnowledgePoints.length,
    });
  } catch (error: unknown) {
    console.error('[AI] chapter question generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
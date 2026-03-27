export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';
import { getMaterialSource } from '@/lib/material-source-store';
import type { LanguageModel } from 'ai';

const titleSchema = z.object({
  title: z.string().min(2).max(80),
});

const chapterQuestionItemSchema = z.object({
  knowledgePointId: z.string(),
  sentence: z.string(),
  answers: nonEmptyStringArray,
});

const chapterQuestionSchema = z.union([
  z.object({
    questions: z.array(chapterQuestionItemSchema),
  }),
  z.array(chapterQuestionItemSchema),
]);

const singleQuestionSchema = z.object({
  sentence: z.string(),
  answers: nonEmptyStringArray,
});

type KnowledgePointLite = {
  id: string;
  name: string;
  originalText: string;
};

const normalizeBatchQuestions = (
  value: z.infer<typeof chapterQuestionSchema>
): Array<z.infer<typeof chapterQuestionItemSchema>> => {
  return Array.isArray(value) ? value : value.questions;
};

async function generateSingleQuestion(model: LanguageModel, promptTemplate: string, kp: KnowledgePointLite) {
  const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict question generator.
Task: Generate exactly one cloze question from the input knowledge point.

Return JSON only with this schema:
{
  "sentence": "... {{blank_0}} ...",
  "answers": ["..."]
}

Rules:
1. Do not output markdown or explanations.
2. sentence must include at least one placeholder.
3. answers must match placeholder order.
4. Question must rely on source text.

Example:
{
  "sentence": "A process switch saves {{blank_0}}.",
  "answers": ["CPU context"]
}

Knowledge point name:
${kp.name}
Source text:
${kp.originalText}
`;

  return generateJsonWithSchema({
    model,
    schema: singleQuestionSchema,
    prompt,
    temperature: 0.35,
    maxRetries: 2,
    debugRoute: '/api/ai/regenerate-title-questions#single-fallback',
    debugInput: { knowledgePointId: kp.id, knowledgePointName: kp.name },
  });
}

export async function POST(req: Request) {
  try {
    const { materialId, chapterId } = await req.json();
    if (!materialId || !chapterId) {
      return NextResponse.json({ error: 'materialId and chapterId are required' }, { status: 400 });
    }

    const promptTemplate = getPromptTemplate(req);
    const model = getAiAdapter(req);

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        chapters: {
          include: {
            knowledgePoints: {
              include: { questions: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const chapter = material.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const reconstructedText = material.chapters
      .map((ch) =>
        `# ${ch.name}\n${ch.knowledgePoints
          .map((kp) => `${kp.name}\n${kp.originalText}`.trim())
          .join('\n\n')}`.trim()
      )
      .join('\n\n');

    const storedSource = await getMaterialSource(materialId).catch(() => null);
    const sourceText = storedSource?.trim() || reconstructedText;
    const sourceContext = `Material source:\n${sourceText}`;

    const titlePrompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a title optimizer.
Task: Generate one concise and specific title for this learning material.

Rules:
1. Return JSON only.
2. Use schema: { "title": "..." }
3. Length 6-40 characters preferred.
4. Keep meaning aligned with source content.

Example:
{ "title": "Computer Networks Final Review" }

Current title:
${material.title}
${sourceContext}
`;

    const titleResult = await generateJsonWithSchema({
      model,
      schema: titleSchema,
      prompt: titlePrompt,
      temperature: 0.3,
      maxRetries: 2,
      debugRoute: '/api/ai/regenerate-title-questions#title',
      debugInput: {
        materialId,
        chapterId,
        currentTitle: material.title,
        sourceLength: sourceText.length,
      },
    });

    const newTitle = titleResult.title.trim();

    await prisma.$transaction([
      prisma.errorLog.deleteMany({
        where: {
          question: {
            knowledgePoint: {
              chapterId,
            },
          },
        },
      }),
      prisma.question.deleteMany({
        where: {
          knowledgePoint: {
            chapterId,
          },
        },
      }),
      prisma.material.update({
        where: { id: materialId },
        data: { title: newTitle },
      }),
    ]);

    const chapterAfterClear = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        knowledgePoints: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!chapterAfterClear) {
      return NextResponse.json({ error: 'Chapter not found after reset' }, { status: 404 });
    }

    const batchPrompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict question generator.
Task: Generate one cloze question for EACH knowledge point in this chapter.

Return JSON only.
Accepted output shapes:
A) { "questions": [ { "knowledgePointId": "...", "sentence": "... {{blank_0}} ...", "answers": ["..."] } ] }
B) [ { "knowledgePointId": "...", "sentence": "... {{blank_0}} ...", "answers": ["..."] } ]

Rules:
1. Every input knowledgePointId should appear exactly once.
2. sentence must include at least one placeholder.
3. answers must match placeholder order.
4. No explanations, no markdown.

Example:
{
  "questions": [
    {
      "knowledgePointId": "kp_01",
      "sentence": "The scheduler chooses {{blank_0}} first.",
      "answers": ["the next runnable process"]
    }
  ]
}

Knowledge points input:
${JSON.stringify(
  chapterAfterClear.knowledgePoints.map((kp) => ({
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
      debugRoute: '/api/ai/regenerate-title-questions#chapter-batch',
      debugInput: {
        materialId,
        chapterId,
        knowledgePointCount: chapterAfterClear.knowledgePoints.length,
      },
    });

    const kpMap = new Map(chapterAfterClear.knowledgePoints.map((kp) => [kp.id, kp]));
    const questionMap = new Map<string, { sentence: string; answers: string[] }>();

    for (const item of normalizeBatchQuestions(batchResult)) {
      if (!kpMap.has(item.knowledgePointId)) continue;
      if (!item.sentence || !item.answers?.length) continue;
      if (!questionMap.has(item.knowledgePointId)) {
        questionMap.set(item.knowledgePointId, { sentence: item.sentence, answers: item.answers });
      }
    }

    const missing = chapterAfterClear.knowledgePoints.filter((kp) => !questionMap.has(kp.id));
    for (const kp of missing) {
      try {
        const single = await generateSingleQuestion(model, promptTemplate, {
          id: kp.id,
          name: kp.name,
          originalText: kp.originalText,
        });
        questionMap.set(kp.id, single);
      } catch (error) {
        console.error('[AI] regenerate fallback single question failed:', kp.id, error);
      }
    }

    const toCreate = chapterAfterClear.knowledgePoints
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
      title: newTitle,
      createdCount: toCreate.length,
      expectedCount: chapterAfterClear.knowledgePoints.length,
      usedStoredSource: Boolean(storedSource?.trim()),
    });
  } catch (error: unknown) {
    console.error('[AI] regenerate title/questions error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
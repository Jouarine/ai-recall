export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';

const materialQuestionSchema = z.object({
  questions: z.array(
    z.object({
      knowledgePointId: z.string(),
      sentence: z.string(),
      answers: nonEmptyStringArray,
    })
  ),
});

export async function POST(req: Request) {
  try {
    const { materialId, replaceExisting = true } = (await req.json()) as {
      materialId?: string;
      replaceExisting?: boolean;
    };

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
    }

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        chapters: {
          include: {
            knowledgePoints: {
              include: { questions: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const allKnowledgePoints = material.chapters.flatMap((chapter) => chapter.knowledgePoints);
    if (allKnowledgePoints.length === 0) {
      return NextResponse.json({ createdCount: 0, expectedCount: 0 });
    }

    const targetKnowledgePoints = replaceExisting
      ? allKnowledgePoints
      : allKnowledgePoints.filter((kp) => (kp.questions?.length || 0) === 0);

    if (targetKnowledgePoints.length === 0) {
      return NextResponse.json({ createdCount: 0, expectedCount: 0 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const reconstructedText = material.chapters
      .map(
        (chapter) =>
          `【${chapter.name}】\n${chapter.knowledgePoints
            .map((kp) => `${kp.name}\n${kp.originalText}`.trim())
            .join('\n\n')}`.trim()
      )
      .join('\n\n');

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}你是严谨的出题助手。
任务：为下方每个知识点生成 1 道填空题，必须覆盖全部知识点，不能遗漏。
规则：
1. 只输出题目数据，不要解释。
2. 每题保留 knowledgePointId。
3. sentence 使用 {{blank_0}} 样式占位符。
4. answers 与占位符顺序一致。
5. 题干必须基于原文，不能编造。

资料全文：
${reconstructedText}

目标知识点列表：
${JSON.stringify(
  targetKnowledgePoints.map((kp) => ({
    knowledgePointId: kp.id,
    chapterName: material.chapters.find((chapter) => chapter.id === kp.chapterId)?.name || '',
    name: kp.name,
    originalText: kp.originalText,
  }))
)}
`;

    const generated = await generateJsonWithSchema({
      model,
      schema: materialQuestionSchema,
      prompt,
      temperature: 0.35,
      maxRetries: 1,
      debugRoute: '/api/ai/generate-material-questions',
      debugInput: {
        materialId,
        replaceExisting,
        targetKnowledgePointCount: targetKnowledgePoints.length,
      },
    });

    const targetMap = new Map(targetKnowledgePoints.map((kp) => [kp.id, kp]));
    const uniqueByKp = new Map<string, { sentence: string; answers: string[] }>();

    for (const item of generated.questions || []) {
      if (!targetMap.has(item.knowledgePointId)) continue;
      if (!item.sentence || !item.answers?.length) continue;
      if (!uniqueByKp.has(item.knowledgePointId)) {
        uniqueByKp.set(item.knowledgePointId, { sentence: item.sentence, answers: item.answers });
      }
    }

    if (replaceExisting) {
      await prisma.$transaction([
        prisma.errorLog.deleteMany({
          where: {
            question: {
              knowledgePoint: {
                chapter: {
                  materialId,
                },
              },
            },
          },
        }),
        prisma.question.deleteMany({
          where: {
            knowledgePoint: {
              chapter: {
                materialId,
              },
            },
          },
        }),
      ]);
    }

    const toCreate = targetKnowledgePoints
      .map((kp) => {
        const item = uniqueByKp.get(kp.id);
        if (!item) return null;

        const answers = item.answers.filter(Boolean);
        const blanksData = answers.map((answer, index) => ({ id: `b${index}`, answer, index }));
        if (!item.sentence || blanksData.length === 0) return null;

        return {
          knowledgePointId: kp.id,
          type: 'cloze',
          blanksData: JSON.stringify(blanksData),
          usedBlanksHistory: JSON.stringify(answers),
          displayText: item.sentence,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (toCreate.length > 0) {
      await prisma.$transaction(toCreate.map((data) => prisma.question.create({ data })));
    }

    return NextResponse.json({
      createdCount: toCreate.length,
      expectedCount: targetKnowledgePoints.length,
      missingCount: Math.max(0, targetKnowledgePoints.length - toCreate.length),
      replaceExisting,
    });
  } catch (error: unknown) {
    console.error('[AI] material question generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

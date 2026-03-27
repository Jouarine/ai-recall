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
          `銆?{chapter.name}銆慭n${chapter.knowledgePoints
            .map((kp) => `${kp.name}\n${kp.originalText}`.trim())
            .join('\n\n')}`.trim()
      )
      .join('\n\n');

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}浣犳槸涓ヨ皑鐨勫嚭棰樺姪鎵嬨€?浠诲姟锛氫负涓嬫柟姣忎釜鐭ヨ瘑鐐圭敓鎴?1 閬撳～绌洪锛屽繀椤昏鐩栧叏閮ㄧ煡璇嗙偣锛屼笉鑳介仐婕忋€?瑙勫垯锛?1. 鍙緭鍑洪鐩暟鎹紝涓嶈瑙ｉ噴銆?2. 姣忛淇濈暀 knowledgePointId銆?3. sentence 浣跨敤 {{blank_0}} 鏍峰紡鍗犱綅绗︺€?4. answers 涓庡崰浣嶇椤哄簭涓€鑷淬€?5. 棰樺共蹇呴』鍩轰簬鍘熸枃锛屼笉鑳界紪閫犮€?
璧勬枡鍏ㄦ枃锛?${reconstructedText}

鐩爣鐭ヨ瘑鐐瑰垪琛細
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

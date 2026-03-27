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
浣犳槸楂樿川閲忓～绌洪鍔╂墜锛岃鍙负杩欎釜鐭ヨ瘑鐐圭敓鎴?1 閬撳～绌洪銆?瑕佹眰锛?1. sentence 浣跨敤 {{blank_0}} 鍗犱綅绗︽牸寮忋€?2. answers 鎸夊崰浣嶇椤哄簭杩斿洖銆?3. 棰樼洰蹇呴』蹇犱簬鍘熸枃锛屼笉鑳界紪閫犮€?
鐭ヨ瘑鐐癸細${kp.name}
鍘熸枃锛?{kp.originalText}
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
        `銆?{ch.name}銆慭n${ch.knowledgePoints
          .map((kp) => `${kp.name}\n${kp.originalText}`.trim())
          .join('\n\n')}`.trim()
      )
      .join('\n\n');

    const storedSource = await getMaterialSource(materialId).catch(() => null);
    const sourceText = storedSource?.trim() || reconstructedText;
    const sourceContext = `璧勬枡鍏ㄦ枃锛歕n${sourceText}`;

    const titlePrompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
浣犳槸瀛︿範璧勬枡鍛藉悕鍔╂墜銆傝鏍规嵁璧勬枡鍏ㄦ枃涓庣珷鑺傜粨鏋勭敓鎴愪竴涓畝娲併€佷笓涓氱殑涓枃鏍囬銆?褰撳墠鏍囬锛?{material.title}
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
浣犳槸楂樿川閲忓～绌洪鍔╂墜銆傝涓烘瘡涓煡璇嗙偣鍚勭敓鎴?1 閬撳～绌洪锛屽繀椤昏鐩栧叏閮ㄧ煡璇嗙偣锛屼笉鑳介仐婕忋€?瑕佹眰锛?1. 蹇呴』淇濈暀 knowledgePointId銆?2. sentence 浣跨敤 {{blank_0}} 鍗犱綅绗︽牸寮忋€?3. answers 鎸夊崰浣嶇椤哄簭杩斿洖銆?4. 涓嶈兘鏂板涓嶅湪鍒楄〃涓殑 knowledgePointId銆?
鐭ヨ瘑鐐瑰垪琛細
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

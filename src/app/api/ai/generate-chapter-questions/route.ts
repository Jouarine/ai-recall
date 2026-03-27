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
娴ｇ姵妲告妯垮窛闁插繐锝炵粚娲暯閸斺晜澧滈敍宀冾嚞閸欘亙璐熸潻娆庨嚋閻儴鐦戦悙鍦晸閹?1 闁挸锝炵粚娲暯閵?鐟曚焦鐪伴敍?1. sentence 娴ｈ法鏁?{{blank_0}} 閸楃姳缍呯粭锔界壐瀵繈鈧?2. answers 閹稿宕版担宥囶儊妞ゅ搫绨潻鏂挎礀閵?3. 妫版娲拌箛鍛淬€忚箛鐘辩艾閸樼喐鏋冮敍灞肩瑝閼崇晫绱柅鐘偓?
閻儴鐦戦悙鐧哥窗${knowledgePoint.name}
閸樼喐鏋冮敍?{knowledgePoint.originalText}
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
娴ｇ姵妲告妯垮窛闁插繐锝炵粚娲暯閸斺晜澧滈妴鍌濐嚞娑撶儤鐦℃稉顏嗙叀鐠囧棛鍋ｉ崥鍕晸閹?1 闁挸锝炵粚娲暯閿涘苯绻€妞ゆ槒顩惄鏍у弿闁劎鐓＄拠鍡欏仯閿涘奔绗夐懗浠嬩粣濠曞繈鈧?鐟曚焦鐪伴敍?1. 韫囧懘銆忔穱婵堟殌 knowledgePointId閵?2. sentence 娴ｈ法鏁?{{blank_0}} 閸楃姳缍呯粭锔界壐瀵繈鈧?3. answers 閹稿宕版担宥囶儊妞ゅ搫绨潻鏂挎礀閵?4. 娑撳秷鍏橀弬鏉款杻娑撳秴婀崚妤勩€冩稉顓犳畱 knowledgePointId閵?
閻儴鐦戦悙鐟板灙鐞涱煉绱?${JSON.stringify(
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

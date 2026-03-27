export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { saveMaterialSource } from '@/lib/material-source-store';

type QuestionInput = {
  type?: string;
  stem?: string;
  sentence?: string;
  answers?: string[];
  options?: string[];
  referenceAnswer?: string;
};

type ChapterInput = {
  name?: string;
  knowledgePoints?: Array<{
    name?: string;
    originalText?: string;
    question?: QuestionInput;
  }>;
};

const buildQuestionPayload = (question: QuestionInput | undefined, fallbackName: string) => {
  const type = (question?.type || 'cloze').toLowerCase();

  if (type === 'cloze') {
    const sentence = question?.sentence?.trim();
    const answers = (question?.answers || []).map((item) => item.trim()).filter(Boolean);

    if (!sentence || answers.length === 0) {
      return null;
    }

    const blanksData = answers.map((answer, index) => ({ id: `b${index}`, answer, index }));

    return {
      type: 'cloze',
      displayText: sentence,
      blanksData: JSON.stringify(blanksData),
      usedBlanksHistory: JSON.stringify(answers),
      qaQuestion: null,
      qaReferenceAnswer: null,
    };
  }

  const stem = (question?.stem || '').trim() || `请根据知识点作答：${fallbackName}`;
  const options = (question?.options || []).map((item) => item.trim()).filter(Boolean);
  const reference = (question?.referenceAnswer || '').trim() || fallbackName;

  const formattedStem =
    type === 'choice' && options.length
      ? `${stem}\n${options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}`
      : stem;

  return {
    type,
    qaQuestion: formattedStem,
    qaReferenceAnswer: reference,
    displayText: null,
    blanksData: null,
    usedBlanksHistory: null,
  };
};

export async function GET() {
  try {
    const materials = await prisma.material.findMany({
      include: {
        chapters: {
          include: {
            knowledgePoints: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      chapters?: ChapterInput[];
      sourceText?: string;
    };
    const { title, chapters, sourceText } = body;

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { name: 'Dev User' } });
    }

    if (!title || !chapters) {
      return NextResponse.json({ error: 'Title and chapters are required' }, { status: 400 });
    }

    const material = await prisma.material.create({
      data: {
        title,
        userId: user.id,
        chapters: {
          create: chapters.map((chapter, chapterIndex) => ({
            name: chapter.name || '未命名章节',
            orderIndex: chapterIndex,
            knowledgePoints: {
              create: (chapter.knowledgePoints || []).map((knowledgePoint, pointIndex) => {
                const kpName = knowledgePoint.name || '未命名知识点';
                const questionPayload = buildQuestionPayload(knowledgePoint.question, kpName);
                return {
                  name: kpName,
                  originalText: knowledgePoint.originalText || '',
                  orderIndex: pointIndex,
                  questions: questionPayload ? { create: [questionPayload] } : undefined,
                };
              }),
            },
          })),
        },
      },
      include: {
        chapters: {
          include: {
            knowledgePoints: {
              include: { questions: true },
            },
          },
        },
      },
    });

    if (typeof sourceText === 'string' && sourceText.trim()) {
      await saveMaterialSource(material.id, sourceText.trim());
    }

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error('Error creating material:', error);
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const logs = await prisma.errorLog.findMany({
      include: {
        question: {
          include: {
            knowledgePoint: {
              include: {
                chapter: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const payload = logs.map((log) => {
      const question = log.question;
      const kp = question.knowledgePoint;
      const chapter = kp.chapter;

      return {
        id: log.id,
        questionId: log.questionId,
        question:
          question.type.toLowerCase() === 'cloze'
            ? {
                id: question.id,
                type: 'cloze',
                knowledgePointId: kp.id,
                originalText: kp.originalText,
                displayText: question.displayText || kp.originalText,
                blanks: [],
                isStarred: question.isStarred,
              }
            : {
                id: question.id,
                type: 'short_answer',
                knowledgePointId: kp.id,
                question: question.qaQuestion || '未命名题目',
                referenceAnswer: question.qaReferenceAnswer || '',
                isStarred: question.isStarred,
              },
        chapterName: chapter.name,
        knowledgePointName: kp.name,
        errorCount: log.errorCount,
        lastErrorAt: log.updatedAt,
        resolved: log.isResolved,
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    return NextResponse.json({ error: 'Failed to fetch error logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionId, userWrongAnswer } = body as {
      questionId?: string;
      userWrongAnswer?: string;
    };

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { name: 'Dev User' } });
    }

    const errorLog = await prisma.errorLog.upsert({
      where: {
        questionId_userId: {
          questionId,
          userId: user.id,
        },
      },
      update: {
        errorCount: {
          increment: 1,
        },
        userWrongAnswer,
        isResolved: false,
      },
      create: {
        questionId,
        userId: user.id,
        userWrongAnswer,
      },
    });

    return NextResponse.json(errorLog, { status: 200 });
  } catch (error) {
    console.error('Error logging incorrect answer:', error);
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}

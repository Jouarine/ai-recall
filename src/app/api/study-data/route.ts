export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteMaterialSource } from '@/lib/material-source-store';

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const materialId = body?.materialId as string | undefined;
    const clearSourceText = Boolean(body?.clearSourceText);

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
    }

    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        chapter: {
          materialId,
        },
      },
      select: {
        id: true,
      },
    });

    const knowledgePointIds = knowledgePoints.map((item) => item.id);

    const questions = knowledgePointIds.length
      ? await prisma.question.findMany({
          where: {
            knowledgePointId: {
              in: knowledgePointIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];

    const questionIds = questions.map((item) => item.id);

    const [errorDeleteResult, questionDeleteResult] = await prisma.$transaction([
      prisma.errorLog.deleteMany({
        where: questionIds.length
          ? {
              questionId: {
                in: questionIds,
              },
            }
          : {},
      }),
      prisma.question.deleteMany({
        where: knowledgePointIds.length
          ? {
              knowledgePointId: {
                in: knowledgePointIds,
              },
            }
          : {},
      }),
    ]);

    await prisma.material
      .update({
        where: { id: materialId },
        data: { progress: 0 },
      })
      .catch(() => null);

    if (clearSourceText) {
      await prisma.knowledgePoint
        .updateMany({
          where: {
            chapter: {
              materialId,
            },
          },
          data: {
            originalText: '',
          },
        })
        .catch(() => null);

      await deleteMaterialSource(materialId).catch(() => null);
    }

    return NextResponse.json({
      deletedErrorLogs: errorDeleteResult.count,
      deletedQuestions: questionDeleteResult.count,
      clearedSourceText: clearSourceText,
    });
  } catch (error) {
    console.error('Error clearing study data:', error);
    return NextResponse.json({ error: 'Failed to clear study data' }, { status: 500 });
  }
}

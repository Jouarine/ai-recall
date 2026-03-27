export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const favorites = await prisma.question.findMany({
      where: { isStarred: true },
      include: {
        knowledgePoint: {
          include: {
            chapter: {
              include: {
                material: true,
              },
            },
          },
        },
        errorLogs: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(
      favorites.map((q) => ({
        id: q.id,
        type: q.type,
        isStarred: q.isStarred,
        displayText: q.displayText,
        qaQuestion: q.qaQuestion,
        updatedAt: q.updatedAt,
        originalText: q.knowledgePoint.originalText,
        knowledgePointName: q.knowledgePoint.name,
        chapterName: q.knowledgePoint.chapter.name,
        materialTitle: q.knowledgePoint.chapter.material.title,
        errorCount: q.errorLogs.reduce((sum, log) => sum + log.errorCount, 0),
      }))
    );
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}


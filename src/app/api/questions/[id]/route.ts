export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { blanksData, usedBlanksHistory, displayText, isStarred, type, qaQuestion, qaReferenceAnswer } = body;

    const question = await prisma.question.update({
      where: { id },
      data: {
        type: typeof type === 'string' ? type : undefined,
        blanksData: blanksData === null ? null : blanksData ? JSON.stringify(blanksData) : undefined,
        usedBlanksHistory: usedBlanksHistory === null ? null : usedBlanksHistory ? JSON.stringify(usedBlanksHistory) : undefined,
        displayText: displayText === null ? null : displayText || undefined,
        qaQuestion: qaQuestion === null ? null : qaQuestion || undefined,
        qaReferenceAnswer: qaReferenceAnswer === null ? null : qaReferenceAnswer || undefined,
        isStarred: typeof isStarred === 'boolean' ? isStarred : undefined,
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

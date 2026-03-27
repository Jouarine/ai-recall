import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { knowledgePointId, type, blanksData, usedBlanksHistory, displayText, qaQuestion, qaReferenceAnswer } = body;

    if (!knowledgePointId || !type) {
      return NextResponse.json({ error: 'knowledgePointId and type are required' }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: {
        knowledgePointId,
        type,
        blanksData: blanksData ? JSON.stringify(blanksData) : null,
        usedBlanksHistory: usedBlanksHistory ? JSON.stringify(usedBlanksHistory) : null,
        displayText,
        qaQuestion,
        qaReferenceAnswer,
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}

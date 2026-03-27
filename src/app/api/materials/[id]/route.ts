import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteMaterialSource } from '@/lib/material-source-store';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const material = await prisma.material.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json({ error: 'Failed to update material' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await prisma.material.delete({ where: { id } });
    await deleteMaterialSource(id).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 });
  }
}

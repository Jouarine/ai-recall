export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { clearAiLogs, readAiLogs } from '@/lib/ai-debug-log';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') || '100');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
    const logs = await readAiLogs(limit);
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error reading AI logs:', error);
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearAiLogs();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error clearing AI logs:', error);
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}

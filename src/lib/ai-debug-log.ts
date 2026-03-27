import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_PATH = path.join(DATA_DIR, 'ai-logs.jsonl');

export type AiLogEntry = {
  id: string;
  time: string;
  route: string;
  input: unknown;
  prompt: string;
  output: string;
  error?: string;
};

async function ensureLogFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LOG_PATH);
  } catch {
    await fs.writeFile(LOG_PATH, '', 'utf8');
  }
}

export async function appendAiLog(entry: Omit<AiLogEntry, 'id' | 'time'>) {
  await ensureLogFile();
  const full: AiLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    ...entry,
  };
  await fs.appendFile(LOG_PATH, `${JSON.stringify(full)}\n`, 'utf8');
}

export async function readAiLogs(limit = 100): Promise<AiLogEntry[]> {
  await ensureLogFile();
  const text = await fs.readFile(LOG_PATH, 'utf8');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sliced = lines.slice(Math.max(0, lines.length - limit)).reverse();
  const parsed: AiLogEntry[] = [];
  for (const line of sliced) {
    try {
      parsed.push(JSON.parse(line) as AiLogEntry);
    } catch {
      // ignore malformed line
    }
  }
  return parsed;
}

export async function clearAiLogs() {
  await ensureLogFile();
  await fs.writeFile(LOG_PATH, '', 'utf8');
}

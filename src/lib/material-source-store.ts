import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'material-sources.json');

type MaterialSourceMap = Record<string, string>;

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<MaterialSourceMap> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    return JSON.parse(raw) as MaterialSourceMap;
  } catch {
    return {};
  }
}

async function writeStore(data: MaterialSourceMap) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function saveMaterialSource(materialId: string, sourceText: string) {
  const store = await readStore();
  store[materialId] = sourceText;
  await writeStore(store);
}

export async function getMaterialSource(materialId: string): Promise<string | null> {
  const store = await readStore();
  return store[materialId] || null;
}

export async function deleteMaterialSource(materialId: string) {
  const store = await readStore();
  if (store[materialId]) {
    delete store[materialId];
    await writeStore(store);
  }
}


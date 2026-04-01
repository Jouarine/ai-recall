import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'material-sources.json');

type MaterialSourceMap = Record<string, string>;

async function ensureStoreFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(STORE_PATH);
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
    } catch {
      // Ignore readonly / ephemeral filesystem errors in hosted environments.
    }
  }
}

async function readStore(): Promise<MaterialSourceMap> {
  try {
    await ensureStoreFile();
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as MaterialSourceMap;
  } catch {
    return {};
  }
}

async function writeStore(data: MaterialSourceMap) {
  try {
    await ensureStoreFile();
    await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Ignore readonly / ephemeral filesystem errors in hosted environments.
  }
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

import prisma from '@/lib/prisma';

export async function saveMaterialSource(materialId: string, sourceText: string) {
  await prisma.materialSource.upsert({
    where: { materialId },
    update: { sourceText },
    create: { materialId, sourceText },
  });
}

export async function getMaterialSource(materialId: string): Promise<string | null> {
  const record = await prisma.materialSource.findUnique({
    where: { materialId },
    select: { sourceText: true },
  });

  return record?.sourceText || null;
}

export async function deleteMaterialSource(materialId: string) {
  await prisma.materialSource.deleteMany({
    where: { materialId },
  });
}

/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: { name: 'Test User 1', email: 'test1@example.com' },
  });
  console.log('Created user:', user.id);

  const material = await prisma.material.create({
    data: {
      title: 'Python Foundation',
      userId: user.id,
      chapters: {
        create: [
          {
            name: 'Chapter 1: Basics',
            knowledgePoints: {
              create: [
                {
                  name: 'Lists',
                  originalText: 'A list in Python is an ordered and mutable collection of items.',
                  questions: {
                    create: [
                      {
                        type: 'CLOZE',
                        blanksData: JSON.stringify([{ id: 'b1', answer: 'ordered', index: 0 }]),
                        usedBlanksHistory: JSON.stringify(['ordered', 'mutable']),
                        displayText: 'A list in Python is an {{blank_0}} and mutable collection of items.',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('Created material with chapters, KPs, and questions:', material.id);

  const fetchedMaterial = await prisma.material.findUnique({
    where: { id: material.id },
    include: {
      chapters: {
        include: {
          knowledgePoints: {
            include: {
              questions: true,
            },
          },
        },
      },
    },
  });

  console.dir(fetchedMaterial, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());

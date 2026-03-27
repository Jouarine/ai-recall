export const runtime = 'nodejs';

import { z } from 'zod';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { NextResponse } from 'next/server';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';

const schema = z.object({
  sentence: z.string().describe('Sentence with placeholders like {{blank_0}}'),
  answers: nonEmptyStringArray.describe('Answers ordered by placeholder index'),
});

export async function POST(req: Request) {
  try {
    const { originalText, usedBlanksHistory = [], additionalPrompt = '' } = await req.json();

    if (!originalText) {
      return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const historyPrompt =
      Array.isArray(usedBlanksHistory) && usedBlanksHistory.length > 0
        ? `Avoid using these previous answers: ${usedBlanksHistory.join(', ')}`
        : 'Generate 1-3 high-value blanks that test core concepts.';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict cloze-question generator.
Task: Create one cloze question from source text.

Return JSON only. No markdown, no explanation.
Required schema:
{
  "sentence": "... {{blank_0}} ...",
  "answers": ["..."]
}

Rules:
1. sentence must contain at least one placeholder {{blank_n}}.
2. answers must align with placeholder order.
3. Keep wording faithful to source text.
4. Keep question concise and test-worthy.

Example output:
{
  "sentence": "A binary search has time complexity {{blank_0}}.",
  "answers": ["O(log n)"]
}

${historyPrompt}
Additional instruction:
${additionalPrompt || 'None'}
Source text:
${originalText}
`;

    const result = await generateJsonWithSchema({
      model,
      schema,
      prompt,
      temperature: 0.5,
      maxRetries: 2,
      debugRoute: '/api/ai/generate-cloze',
      debugInput: {
        originalTextLength: String(originalText).length,
        usedBlanksHistoryCount: Array.isArray(usedBlanksHistory) ? usedBlanksHistory.length : 0,
        hasAdditionalPrompt: Boolean(String(additionalPrompt || '').trim()),
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] cloze generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export const runtime = 'nodejs';

import { z } from 'zod';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { NextResponse } from 'next/server';
import { generateJsonWithSchema } from '@/lib/ai-json';

const schema = z.object({
  question: z.string(),
  referenceAnswer: z.string(),
  options: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const { originalText, questionType = 'short_answer', additionalPrompt = '' } = await req.json();

    if (!originalText) {
      return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
    }

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);
    const normalizedType = String(questionType).toLowerCase();

    const typeInstruction =
      normalizedType === 'choice'
        ? 'Generate exactly one multiple-choice question with exactly 4 options and one clear referenceAnswer.'
        : normalizedType === 'thinking'
          ? 'Generate exactly one thinking question that requires reasoning, with a concise referenceAnswer.'
          : normalizedType === 'application'
            ? 'Generate exactly one application question with a practical scenario, with a concise referenceAnswer.'
            : 'Generate exactly one short-answer question with a concise referenceAnswer.';

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
You are a strict question generator.
${typeInstruction}

Return JSON only. No markdown, no explanations.
Required schema:
{
  "question": "...",
  "referenceAnswer": "...",
  "options": ["...", "...", "...", "..."]
}

Rules:
1. For choice type, options must be present with exactly 4 entries.
2. For non-choice types, options should be omitted.
3. Keep wording specific and answerable from source text.
4. Keep referenceAnswer short and precise.

Example (choice):
{
  "question": "Which layer handles routing in the OSI model?",
  "referenceAnswer": "Network layer",
  "options": ["Physical layer", "Data link layer", "Network layer", "Transport layer"]
}

Example (short_answer):
{
  "question": "What is the purpose of a mutex?",
  "referenceAnswer": "To ensure mutual exclusion for shared resources"
}

Additional instruction:
${additionalPrompt || 'None'}
Source text:
${originalText}
`;

    const result = await generateJsonWithSchema({
      model,
      schema,
      prompt,
      temperature: 0.2,
      maxRetries: 2,
      debugRoute: '/api/ai/generate-qa',
      debugInput: {
        questionType: normalizedType,
        originalTextLength: String(originalText).length,
        hasAdditionalPrompt: Boolean(String(additionalPrompt || '').trim()),
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] QA generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
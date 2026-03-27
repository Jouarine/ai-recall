export const runtime = 'nodejs';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAiAdapter, getPromptTemplate } from '@/lib/ai-adapter';
import { generateJsonWithSchema, nonEmptyStringArray } from '@/lib/ai-json';

const strictSchema = z.object({
  chapters: z.array(
    z.object({
      name: z.string().min(1),
      knowledgePoints: z.array(
        z.object({
          name: z.string().min(1),
          originalText: z.string().min(1),
          question: z.object({
            type: z.string().min(1),
            stem: z.string().optional(),
            sentence: z.string().optional(),
            answers: z.array(z.string()).optional(),
            options: z.array(z.string()).optional(),
            referenceAnswer: z.string().optional(),
          }),
        })
      ),
    })
  ),
});

const looseSchema = z.object({
  chapters: z.array(z.record(z.string(), z.unknown())).min(1),
});

const pickString = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const normalizeType = (rawType: string, allowedTypes: string[]): string => {
  const t = rawType.toLowerCase().trim();
  if (['choice', 'multiple_choice', '选择题'].includes(t)) return allowedTypes.includes('choice') ? 'choice' : allowedTypes[0];
  if (['cloze', 'fill', 'fill_blank', '填空题'].includes(t)) return allowedTypes.includes('cloze') ? 'cloze' : allowedTypes[0];
  if (['short_answer', 'qa', '简答题'].includes(t)) return allowedTypes.includes('short_answer') ? 'short_answer' : allowedTypes[0];
  if (['thinking', '思考题'].includes(t)) return allowedTypes.includes('thinking') ? 'thinking' : allowedTypes[0];
  if (['application', '应用题', 'case'].includes(t)) return allowedTypes.includes('application') ? 'application' : allowedTypes[0];
  return allowedTypes[0] || 'cloze';
};

const normalizeOutline = (raw: z.infer<typeof looseSchema>, allowedTypes: string[]) => {
  const normalized = {
    chapters: raw.chapters.map((rawChapter, chapterIndex) => {
      const chapterName =
        pickString(rawChapter, ['name', 'title', 'chapterName', 'chapter_title', '章节名', '章节']) ||
        `第${chapterIndex + 1}章`;

      const kpRaw = rawChapter.knowledgePoints;
      const points = Array.isArray(kpRaw) ? kpRaw : [];

      const knowledgePoints = points
        .map((item, kpIndex) => {
          const kp = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};

          const kpName =
            pickString(kp, ['name', 'title', 'pointName', 'knowledgePointName', '知识点名', '知识点']) ||
            `知识点${kpIndex + 1}`;

          const originalText = pickString(kp, ['originalText', 'text', 'content', 'sourceText', '原文']) || kpName;

          const qRaw = (kp.question && typeof kp.question === 'object' ? kp.question : {}) as Record<string, unknown>;
          const questionType = normalizeType(
            pickString(qRaw, ['type', 'questionType', '题型']) || pickString(kp, ['type']) || allowedTypes[0] || 'cloze',
            allowedTypes
          );

          const stem =
            pickString(qRaw, ['stem', 'question', 'prompt']) ||
            pickString(kp, ['stem', 'question']) ||
            `请根据知识点作答：${kpName}`;

          const sentenceBase = pickString(qRaw, ['sentence']) || `请根据知识点填空：${kpName} {{blank_0}}`;

          const answersRaw = Array.isArray(qRaw.answers)
            ? qRaw.answers.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
            : [];

          const optionsRaw = Array.isArray(qRaw.options)
            ? qRaw.options.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
            : [];

          const referenceAnswer =
            pickString(qRaw, ['referenceAnswer', 'answer', 'standardAnswer', '参考答案']) ||
            (questionType === 'choice' ? optionsRaw[0] || kpName : kpName);

          if (questionType === 'cloze') {
            const sentence = sentenceBase.includes('{{blank_') ? sentenceBase : `请根据知识点填空：${kpName} {{blank_0}}`;
            const answers = answersRaw.length ? answersRaw : [kpName];
            nonEmptyStringArray.parse(answers);
            return {
              name: kpName,
              originalText,
              question: {
                type: 'cloze',
                sentence,
                answers,
              },
            };
          }

          return {
            name: kpName,
            originalText,
            question: {
              type: questionType,
              stem,
              options: questionType === 'choice' ? (optionsRaw.length ? optionsRaw.slice(0, 4) : [kpName, '选项B', '选项C', '选项D']) : undefined,
              referenceAnswer,
            },
          };
        })
        .filter((kp) => kp.name.trim().length > 0);

      return {
        name: chapterName,
        knowledgePoints,
      };
    }),
  };

  return strictSchema.parse(normalized);
};

export async function POST(req: Request) {
  try {
    const { text, title, questionTypes = ['cloze'], additionalPrompt = '' } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const safeTypes =
      Array.isArray(questionTypes) && questionTypes.length
        ? questionTypes.filter((t: unknown): t is string => typeof t === 'string')
        : ['cloze'];

    const model = getAiAdapter(req);
    const promptTemplate = getPromptTemplate(req);

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}
你是教材结构化与出题助手。请把学习资料拆分为章节和知识点，并为每个知识点生成一道题。
允许题型：${safeTypes.join('、')}
必须输出 JSON，字段固定为：
- chapters[].name
- chapters[].knowledgePoints[].name
- chapters[].knowledgePoints[].originalText
- chapters[].knowledgePoints[].question.type
- chapters[].knowledgePoints[].question.stem
- chapters[].knowledgePoints[].question.sentence
- chapters[].knowledgePoints[].question.answers
- chapters[].knowledgePoints[].question.options
- chapters[].knowledgePoints[].question.referenceAnswer

规则：
1. cloze 使用 sentence + answers。
2. choice 使用 stem + options + referenceAnswer。
3. short_answer / thinking / application 使用 stem + referenceAnswer。
4. 仅输出 JSON，不要解释。
5. 尽量覆盖全部章节，不要只生成前几章。

附加要求：${additionalPrompt || '无'}
资料标题：${title || '未命名资料'}
资料正文：
${text}
`;

    const looseResult = await generateJsonWithSchema({
      model,
      schema: looseSchema,
      prompt,
      temperature: 0.3,
      maxRetries: 2,
      maxOutputTokens: 7000,
      timeoutMs: 180000,
      debugRoute: '/api/ai/generate-outline',
      debugInput: {
        title,
        textLength: String(text).length,
        questionTypes: safeTypes,
        hasAdditionalPrompt: Boolean(String(additionalPrompt || '').trim()),
      },
    });

    const result = normalizeOutline(looseResult, safeTypes);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI] outline generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

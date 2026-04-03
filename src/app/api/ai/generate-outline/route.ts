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
  if (['choice', 'multiple_choice', 'mcq', 'xuan ze ti', '选择题'].includes(t)) {
    return allowedTypes.includes('choice') ? 'choice' : allowedTypes[0];
  }
  if (['cloze', 'fill', 'fill_blank', 'tian kong ti', '填空题'].includes(t)) {
    return allowedTypes.includes('cloze') ? 'cloze' : allowedTypes[0];
  }
  if (['short_answer', 'qa', 'jian da ti', '简答题'].includes(t)) {
    return allowedTypes.includes('short_answer') ? 'short_answer' : allowedTypes[0];
  }
  if (['thinking', 'si kao ti', '思考题'].includes(t)) {
    return allowedTypes.includes('thinking') ? 'thinking' : allowedTypes[0];
  }
  if (['application', 'case', 'ying yong ti', '应用题'].includes(t)) {
    return allowedTypes.includes('application') ? 'application' : allowedTypes[0];
  }
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
            const sentence = sentenceBase.includes('{{blank_')
              ? sentenceBase
              : `请根据知识点填空：${kpName} {{blank_0}}`;
            const answers = answersRaw.length ? answersRaw : [kpName];
            nonEmptyStringArray.parse(answers);

            return {
              name: kpName,
              originalText,
              question: {
                type: 'cloze',
                stem: '',
                sentence,
                answers,
                options: [],
                referenceAnswer: '',
              },
            };
          }

          return {
            name: kpName,
            originalText,
            question: {
              type: questionType,
              stem,
              sentence: '',
              answers: [],
              options: questionType === 'choice' ? (optionsRaw.length ? optionsRaw.slice(0, 4) : [kpName, '选项B', '选项C', '选项D']) : [],
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

    const prompt = `${promptTemplate ? `${promptTemplate}\n\n` : ''}你是教材结构化与出题助手。请将以下资料转为 JSON，严格使用字段，每一条都必须有：
- chapters[].name
- chapters[].knowledgePoints[].name
- chapters[].knowledgePoints[].originalText
- chapters[].knowledgePoints[].question.type
- chapters[].knowledgePoints[].question.stem
- chapters[].knowledgePoints[].question.sentence
- chapters[].knowledgePoints[].question.answers
- chapters[].knowledgePoints[].question.options
- chapters[].knowledgePoints[].question.referenceAnswer

题型范围：${safeTypes.join('、')}
要求：
1. 所有自然语言内容必须使用简体中文。
2. cloze 使用 sentence+answers，且 sentence 必须使用 {{blank_0}}, {{blank_1}}... 占位符。
3. 禁止使用（）/____/[空] 作为填空标记。
4. choice 提供 stem+options+referenceAnswer。
5. short_answer/thinking/application 提供 stem+referenceAnswer。
6. 所有字段必须保留，不能缺字段。
7. 仅输出 JSON，不要解释，不要 Markdown 代码块。
8. 覆盖全部章节和知识点，不要只生成前几章。

示例（必须严格仿照字段结构）：
{
  "chapters": [
    {
      "name": "第一章 计算机网络基础",
      "knowledgePoints": [
        {
          "name": "OSI 七层模型",
          "originalText": "OSI 模型将网络通信划分为七层。",
          "question": {
            "type": "cloze",
            "stem": "",
            "sentence": "OSI 模型共有 {{blank_0}} 层。",
            "answers": ["七"],
            "options": [],
            "referenceAnswer": ""
          }
        }
      ]
    }
  ]
}

附加提示词：${additionalPrompt || '无'}
资料标题：${title || '未命名资料'}
资料正文：
${text}`;

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

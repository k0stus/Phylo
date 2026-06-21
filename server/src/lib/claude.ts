import type { AnalysisResult } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are a physique assessment AI for a competitive fitness tracking app.
Analyze the provided photo and return a JSON object with these exact fields:
{
  "overall_score": <number 1-100>,
  "category_scores": {
    "muscularity": <number 1-100>,
    "leanness": <number 1-100>,
    "symmetry": <number 1-100>,
    "posing": <number 1-100>,
    "conditioning": <number 1-100>
  },
  "ai_feedback": "<2-3 sentence constructive, encouraging assessment>"
}

Be fair, constructive, and encouraging. Focus on athletic development and fitness progress.
Return ONLY valid JSON, no markdown, no explanation.`;

export async function analyzePhysique(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  apiKey: string
): Promise<AnalysisResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Please analyze this physique photo and return the JSON assessment.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json<{
    content: Array<{ type: string; text: string }>;
  }>();

  const text = data.content.find(c => c.type === 'text')?.text ?? '';

  try {
    const parsed = JSON.parse(text) as AnalysisResult;
    // clamp scores to valid range
    parsed.overall_score = clamp(parsed.overall_score);
    for (const key of Object.keys(parsed.category_scores) as Array<keyof typeof parsed.category_scores>) {
      parsed.category_scores[key] = clamp(parsed.category_scores[key]);
    }
    return parsed;
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }
}

function clamp(n: number, min = 1, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

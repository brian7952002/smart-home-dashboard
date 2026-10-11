import { z } from "zod";

/** AI response shapes (spec section 7.3). `estimatedSuccessRate` only ever comes from the model. */

export const aiSourceSchema = z.enum(["ai", "fallback"]);
export type AiSource = z.infer<typeof aiSourceSchema>;

const textList = z.array(z.string().trim().min(1).max(400)).max(12);
const successRate = z.number().int().min(0).max(100).optional();

export const diagnosisBodySchema = z.object({
  diagnosis: z.string().trim().min(1).max(800),
  steps: textList.min(1),
  possibleCauses: textList,
  estimatedSuccessRate: successRate,
});

export const guideBodySchema = z.object({
  overview: z.string().trim().min(1).max(1000),
  quickFixes: textList,
  commonIssues: z
    .array(z.object({ issue: z.string().trim().min(1).max(200), solution: z.string().trim().min(1).max(600) }))
    .max(10),
  maintenanceTips: textList,
  advancedTroubleshooting: textList,
  possibleCauses: textList,
  estimatedSuccessRate: successRate,
});

export type DiagnosisBody = z.infer<typeof diagnosisBodySchema>;
export type GuideBody = z.infer<typeof guideBodySchema>;
export type DiagnosisResponse = DiagnosisBody & { source: AiSource };
export type GuideResponse = GuideBody & { source: AiSource };
export interface ChatResponse {
  source: AiSource;
  answer: string;
}

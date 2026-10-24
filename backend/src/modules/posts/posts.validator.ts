import { z } from "zod";
import { validateTweetText } from "../../utils/twitter-text";

export const createPostSchema = z.object({
  text: z.string().min(1, "Texto do post é obrigatório"),
  scheduledAt: z.string().datetime({ message: "scheduledAt deve ser uma data válida em formato ISO (UTC)" }),
  mediaPaths: z.array(z.string()).max(4, "Máximo de 4 mídias permitidas").default([]),
  threadParts: z.array(z.string()).optional()
}).superRefine((data, ctx) => {
  // 1. Validação do texto principal com twitter-text
  const mainTextVal = validateTweetText(data.text);
  if (!mainTextVal.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: mainTextVal.error || "O texto principal excede o limite de 280 caracteres.",
      path: ["text"]
    });
  }

  // 2. Validação das partes da thread, se houver
  if (data.threadParts && data.threadParts.length > 0) {
    data.threadParts.forEach((part, index) => {
      const partVal = validateTweetText(part);
      if (!partVal.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Parte ${index + 2} da thread excede 280 caracteres (${partVal.length}/280).`,
          path: ["threadParts", index]
        });
      }
    });
  }

  // 3. Validação de data no futuro (com tolerância de 5 segundos para compensar atrasos de rede)
  const scheduledTime = new Date(data.scheduledAt).getTime();
  const now = Date.now() - 5000;
  if (scheduledTime < now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A data de agendamento deve estar no futuro.",
      path: ["scheduledAt"]
    });
  }
});

export const updatePostSchema = z.object({
  text: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  mediaPaths: z.array(z.string()).max(4).optional(),
  threadParts: z.array(z.string()).optional()
}).superRefine((data, ctx) => {
  if (data.text) {
    const val = validateTweetText(data.text);
    if (!val.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: val.error || "O texto excede o limite de 280 caracteres.",
        path: ["text"]
      });
    }
  }
  if (data.threadParts) {
    data.threadParts.forEach((part, index) => {
      const partVal = validateTweetText(part);
      if (!partVal.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Parte ${index + 2} da thread excede 280 caracteres.`,
          path: ["threadParts", index]
        });
      }
    });
  }
});

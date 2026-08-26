import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DIMENSIONS = 256;
// Gemini's embedContent endpoint takes one text per call — cap the batch so
// a caller can't turn one request into a huge, timeout-prone fan-out.
const MAX_BATCH = 50;

export const embedTexts = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        texts: z.array(z.string()).max(MAX_BATCH),
        taskType: z.enum(["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { vectors: data.texts.map(() => null) };

    const vectors = await Promise.all(
      data.texts.map(async (text) => {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                content: { parts: [{ text: text.slice(0, 8000) }] },
                outputDimensionality: DIMENSIONS,
                taskType: data.taskType,
              }),
              signal: AbortSignal.timeout(15_000),
            },
          );
          const json = await res.json();
          const values = json?.embedding?.values;
          return Array.isArray(values) ? (values as number[]) : null;
        } catch {
          return null;
        }
      }),
    );
    return { vectors };
  });

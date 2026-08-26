import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const candidateSchema = z.object({ id: z.string(), text: z.string() });

// Embedding similarity alone isn't precise enough to cut off "real match" vs
// "topically adjacent" (e.g. a cloud-learning reel scoring close to a
// government-job posting for a "government job" query) — cosine scores
// across unrelated bookmarks cluster too tightly to separate with a fixed
// threshold. So this takes the small shortlist embedding search already
// narrowed things down to, and asks an LLM to make the final relevance call.
// Bounded to a shortlist, so cost stays flat regardless of library size.
export const rerankBookmarks = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ query: z.string().min(1), candidates: z.array(candidateSchema).max(30) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey || data.candidates.length === 0) return { ids: [] as string[] };

    const prompt = `A user is searching their saved bookmarks by describing what they remember. Given their query and this shortlist of candidate bookmarks (already narrowed down by similarity search), return only the ids that ACTUALLY match the query's meaning — be strict, exclude anything merely topically adjacent. Most relevant first.

Query: "${data.query}"

Candidates:
${JSON.stringify(data.candidates)}

Respond with ONLY a JSON array of matching id strings, e.g. ["abc123"]. An empty array is fine if nothing truly matches.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const ids = JSON.parse(text);
      return { ids: Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [] };
    } catch {
      return { ids: [] as string[] };
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const bookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  domain: z.string(),
  tags: z.array(z.string()),
  company: z.string().optional(),
  role: z.string().optional(),
});

export const aiSearchBookmarks = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ query: z.string().min(1), bookmarks: z.array(bookmarkSchema) }).parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey || data.bookmarks.length === 0) return { ids: [] as string[] };

    const prompt = `A user is searching their saved bookmarks by describing what they remember, not the exact title. Given their query and the list of bookmarks below (JSON), return the ids of the bookmarks that best match, most relevant first. Only include real matches — an empty array is fine if nothing fits.

Query: "${data.query}"

Bookmarks:
${JSON.stringify(data.bookmarks)}

Respond with ONLY a JSON array of matching id strings, e.g. ["abc123","def456"].`;

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

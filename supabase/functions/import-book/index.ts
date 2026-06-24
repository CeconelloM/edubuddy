import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Text processing (ported from scripts/seed-books.js) ─────────────────────

function stripGutenberg(text: string): string {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const startMatch = text.match(/\*{3}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i);
  if (startMatch) text = text.slice(startMatch.index! + startMatch[0].length);
  const endMatch = text.match(/\*{3}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i);
  if (endMatch) text = text.slice(0, endMatch.index);
  return text.trim();
}

interface ParsedChapter {
  chapter_number: number;
  title: string;
  content: string;
}

function parseChapters(text: string, baseRegex: RegExp): ParsedChapter[] {
  const globalRegex = new RegExp(baseRegex.source, "gim");
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = globalRegex.exec(text)) !== null) positions.push(m.index);
  if (positions.length === 0) return [];

  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    const lines = chunk.split("\n");

    const titleParts = [lines[0].trim()];
    let contentStart = 1;
    for (let j = 1; j < Math.min(6, lines.length); j++) {
      const line = lines[j].trim();
      if (!line) continue;
      if (line.length <= 120 && /^[A-Z\s'",.:!?-]+$/.test(line)) {
        titleParts.push(line);
        contentStart = j + 1;
      }
      break;
    }

    const title = titleParts.join(" — ").replace(/\s{2,}/g, " ").trim();
    const content = lines.slice(contentStart).join("\n").replace(/\n{3,}/g, "\n\n").trim();

    if (content.length < 200) continue;

    chapters.push({ chapter_number: chapters.length + 1, title, content });
  }
  return chapters;
}

// Ordered from most to least specific — first pattern that yields chapters wins
const CHAPTER_REGEXES: RegExp[] = [
  /^(?:Chapter|CHAPTER)\s+(?:[IVXLCDM]+|[0-9]+)\.?/m,
  /^\s*ADVENTURE\s+[IVXLCDM]+[\s.]/im,
  /^\s*[IVXLCDM]{1,4}\.\s{1,4}[A-Z]{2}/im,
  /^\s*[IVXLCDM]{1,4}\.\s*$/im,
  /^(?:CHAPTER|PART|BOOK)\s+(?:[IVXLCDM]+|[0-9]+)/im,
];

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    // 1. Authenticate — the browser sends the user's JWT via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return json({ success: false, error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set" }, 500);
    }

    // Step 1 — Identity: verify the caller's JWT and extract their user ID.
    //          Uses the anon key + user JWT; never the service role key.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

    // Step 2 — Authorisation: read the role from profiles using the service role client.
    //          The service role key is set both as the API key AND as the explicit
    //          Authorization header so it fully bypasses RLS regardless of policies.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return json({ success: false, error: `DB error during role check: ${profileError.message}` }, 403);
    }
    if (profile?.role !== "admin") {
      return json({ success: false, error: `Forbidden: your account has role="${profile?.role ?? "null"}" — must be "admin"` }, 403);
    }

    // 3. Parse & validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const { title, author, difficulty_level, description, gutenberg_url, cover_url } = body as {
      title?: string;
      author?: string;
      difficulty_level?: string;
      description?: string;
      gutenberg_url?: string;
      cover_url?: string;
    };

    if (!title?.trim()) return json({ success: false, error: "title is required" }, 400);
    if (!author?.trim()) return json({ success: false, error: "author is required" }, 400);
    if (!["beginner", "intermediate", "advanced"].includes(difficulty_level ?? "")) {
      return json({ success: false, error: "difficulty_level must be beginner, intermediate, or advanced" }, 400);
    }
    if (!gutenberg_url?.trim()) return json({ success: false, error: "gutenberg_url is required" }, 400);

    // Restrict fetch to Project Gutenberg only — prevents SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(gutenberg_url);
    } catch {
      return json({ success: false, error: "gutenberg_url is not a valid URL" }, 400);
    }
    if (!parsedUrl.hostname.endsWith("gutenberg.org")) {
      return json({ success: false, error: "gutenberg_url must be from gutenberg.org" }, 400);
    }

    // 4. Fetch the raw text from Project Gutenberg
    let raw: string;
    try {
      const res = await fetch(gutenberg_url, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.text();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return json({ success: false, error: `Failed to download book: ${msg}` });
    }

    // 5. Strip boilerplate & parse chapters
    const cleanText = stripGutenberg(raw);
    let chapters: ParsedChapter[] = [];
    for (const regex of CHAPTER_REGEXES) {
      chapters = parseChapters(cleanText, regex);
      if (chapters.length > 0) break;
    }

    if (chapters.length === 0) {
      return json({
        success: false,
        error: "Could not detect chapter structure. Verify the URL points to a plain-text .txt file from Project Gutenberg.",
      });
    }

    // 6. Upsert book record
    const { data: existing } = await adminClient
      .from("books")
      .select("id")
      .eq("title", title.trim())
      .maybeSingle();

    let bookId: string;
    const coverValue = cover_url?.trim() || null;

    if (existing) {
      await adminClient
        .from("books")
        .update({
          author: author.trim(),
          difficulty_level,
          description: description?.trim() ?? null,
          ...(coverValue !== undefined && { cover_url: coverValue }),
        })
        .eq("id", existing.id);
      bookId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await adminClient
        .from("books")
        .insert({
          title: title.trim(),
          author: author.trim(),
          difficulty_level,
          description: description?.trim() ?? null,
          cover_url: coverValue,
        })
        .select("id")
        .single();

      if (insertErr) return json({ success: false, error: `DB error: ${insertErr.message}` });
      bookId = inserted.id;
    }

    // 7. Upsert chapters (one-by-one to avoid needing a DB-level unique constraint)
    let inserted = 0;
    let updated = 0;
    for (const ch of chapters) {
      const { data: existingCh } = await adminClient
        .from("book_chapters")
        .select("id")
        .eq("book_id", bookId)
        .eq("chapter_number", ch.chapter_number)
        .maybeSingle();

      if (existingCh) {
        await adminClient
          .from("book_chapters")
          .update({ title: ch.title, content: ch.content })
          .eq("id", existingCh.id);
        updated++;
      } else {
        await adminClient
          .from("book_chapters")
          .insert({ book_id: bookId, chapter_number: ch.chapter_number, title: ch.title, content: ch.content });
        inserted++;
      }
    }

    return json({
      success: true,
      book_id: bookId,
      chapters_inserted: inserted,
      chapters_updated: updated,
      chapters_total: chapters.length,
      message: `"${title.trim()}" imported — ${inserted} new chapter(s), ${updated} updated.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: `Internal server error: ${msg}` });
  }
});

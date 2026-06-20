/**
 * EduBuddy — Book Seed Script
 * Fetches Peter Pan & Sherlock Holmes from Project Gutenberg,
 * splits them into chapters and upserts everything into Supabase.
 *
 * Usage:
 *   bun run scripts/seed-books.js
 *   node scripts/seed-books.js      (Node 18+)
 *
 * Required in .env.local:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← needed to INSERT (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── .env.local parser (no dotenv dependency needed) ──────────────────────────
function loadEnv(filepath) {
  try {
    const lines = readFileSync(filepath, "utf8").split("\n");
    const env = {};
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv(join(ROOT, ".env.local"));

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌  VITE_SUPABASE_URL not found in .env.local");
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error(
    "❌  SUPABASE_SERVICE_ROLE_KEY not found in .env.local\n" +
      "   → Open your Supabase dashboard → Project Settings → API\n" +
      '   → Copy the "service_role" secret key\n' +
      "   → Add this line to .env.local:\n" +
      "       SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  );
  process.exit(1);
}

// Decode JWT payload to confirm we have the service_role key, not the anon key
function getJwtRole(token) {
  try {
    const payload = token.split(".")[1];
    // base64url → base64: swap URL-safe chars, pad to multiple of 4
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4), "="
    );
    const decoded = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    return decoded.role ?? "unknown";
  } catch {
    return "invalid";
  }
}

const jwtRole = getJwtRole(SERVICE_KEY);
if (jwtRole !== "service_role") {
  console.error(
    `❌  The key in SUPABASE_SERVICE_ROLE_KEY has role="${jwtRole}" — expected "service_role".\n` +
      "   → This looks like the anon key. Copy the service_role key from:\n" +
      "      Supabase Dashboard → Project Settings → API → service_role (secret)"
  );
  process.exit(1);
}
console.log(`🔑  JWT role confirmed: ${jwtRole} ✓\n`);

// Service role bypasses RLS — safe for seed scripts, never expose in frontend
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ── Book definitions ──────────────────────────────────────────────────────────
const BOOKS = [
  {
    title: "Peter Pan",
    author: "J. M. Barrie",
    difficulty_level: "beginner",
    description:
      "The magical tale of Peter Pan, the boy who never grows up, and the Darling children he whisks away to the enchanted island of Neverland.",
    url: "https://www.gutenberg.org/files/16/16-0.txt",
    // Peter Pan uses "Chapter I.", "Chapter II.", etc. (Roman or Arabic)
    chapterRegex: /^(?:Chapter|CHAPTER)\s+(?:[IVXLCDM]+|[0-9]+)\.?/m,
  },
  {
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    difficulty_level: "intermediate",
    description:
      "Twelve gripping detective stories featuring the brilliant consulting detective Sherlock Holmes and his trusted companion Dr. Watson.",
    url: "https://www.gutenberg.org/files/1661/1661-0.txt",
    // Gutenberg editions vary — try patterns from most to least specific.
    // 1. "ADVENTURE  I. A SCANDAL IN BOHEMIA" (extra spaces tolerated)
    // 2. "I. A SCANDAL IN BOHEMIA"  (bare Roman numeral heading)
    // 3. "I.\nA SCANDAL IN BOHEMIA" (numeral on its own line, title follows)
    chapterRegexes: [
      /^\s*ADVENTURE\s+[IVXLCDM]+[\s.]/im,
      /^\s*[IVXLCDM]{1,4}\.\s{1,4}[A-Z]{2}/im,
      /^\s*[IVXLCDM]{1,4}\.\s*$/im,
    ],
  },
];

// ── Text processing helpers ───────────────────────────────────────────────────

/** Remove Project Gutenberg header and footer boilerplate */
function stripGutenberg(text) {
  // Normalize line endings first
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const startMatch = text.match(
    /\*{3}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i
  );
  if (startMatch) text = text.slice(startMatch.index + startMatch[0].length);

  const endMatch = text.match(
    /\*{3}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i
  );
  if (endMatch) text = text.slice(0, endMatch.index);

  return text.trim();
}

/**
 * Split text into chapters using a regex that matches the chapter header line.
 * Returns [{ chapter_number, title, content }]
 */
function parseChapters(text, baseRegex) {
  // Build a global + multiline version of the caller's regex
  const globalRegex = new RegExp(baseRegex.source, "gim");

  // Collect all match positions
  const positions = [];
  let m;
  while ((m = globalRegex.exec(text)) !== null) {
    positions.push(m.index);
  }

  if (positions.length === 0) return [];

  const chapters = [];

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    const lines = chunk.split("\n");

    // --- Build the chapter title ---
    // Line 0 is always the chapter marker (e.g. "Chapter I." or "ADVENTURE I.")
    // If the very next non-empty line is a short caps heading, append it as subtitle
    let titleParts = [lines[0].trim()];
    let contentStart = 1;

    for (let j = 1; j < Math.min(6, lines.length); j++) {
      const line = lines[j].trim();
      if (!line) continue; // skip blank lines
      // Treat it as part of the title if it's short and looks like a heading
      if (line.length <= 120 && /^[A-Z\s'",.:!?-]+$/.test(line)) {
        titleParts.push(line);
        contentStart = j + 1;
      }
      break; // only grab one subtitle line
    }

    const title = titleParts
      .join(" — ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // --- Build the chapter content ---
    const content = lines
      .slice(contentStart)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
      .trim();

    // Skip stubs (table of contents entries, etc.)
    if (content.length < 200) {
      console.log(
        `   ⚠️  Skipping stub at position ${i + 1}: "${title}" (${content.length} chars)`
      );
      continue;
    }

    chapters.push({
      chapter_number: chapters.length + 1, // renumber after stub removal
      title,
      content,
    });
  }

  return chapters;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🚀  EduBuddy Book Seeder\n");

  for (const book of BOOKS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`📖  ${book.title}  (${book.difficulty_level})`);
    console.log(`${"─".repeat(60)}`);

    // 1. Fetch raw text from Project Gutenberg
    console.log(`\n   ↓  Fetching from Project Gutenberg…`);
    let raw;
    try {
      const res = await fetch(book.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.text();
    } catch (err) {
      console.error(`   ❌  Download failed: ${err.message}`);
      continue;
    }
    console.log(`   ✓  Downloaded — ${(raw.length / 1024).toFixed(0)} KB`);

    // 2. Strip Gutenberg boilerplate and parse chapters
    const cleanText = stripGutenberg(raw);

    // Support both single chapterRegex and chapterRegexes[] (tried in order)
    const candidates = book.chapterRegexes ?? [book.chapterRegex];
    let chapters = [];
    let matchedRegex = null;
    for (const regex of candidates) {
      const result = parseChapters(cleanText, regex);
      if (result.length > 0) {
        chapters = result;
        matchedRegex = regex;
        break;
      }
    }

    if (chapters.length === 0) {
      console.error(
        `   ❌  Zero chapters found after trying all ${candidates.length} regex(es).\n` +
          `      Tried: ${candidates.map((r) => r.toString()).join("\n             ")}\n`
      );
      // Dump the first 3000 chars so the user can see the actual chapter format
      console.error("   ── First 3000 chars of cleaned text (for regex debugging) ──");
      console.error(cleanText.slice(0, 3000));
      console.error("   ─────────────────────────────────────────────────────────────");
      continue;
    }
    console.log(`   ✓  Parsed ${chapters.length} chapters  [regex: ${matchedRegex}]`);

    // 3. Check if book already exists; insert if not
    const { data: existing, error: lookupErr } = await supabase
      .from("books")
      .select("id")
      .eq("title", book.title)
      .maybeSingle();

    if (lookupErr) {
      console.error(`   ❌  DB lookup error: ${lookupErr.message}`);
      continue;
    }

    let bookId;
    if (existing) {
      bookId = existing.id;
      console.log(`   ℹ️  Book already in DB (id: ${bookId}) — syncing chapters`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("books")
        .insert({
          title: book.title,
          author: book.author,
          difficulty_level: book.difficulty_level,
          description: book.description,
          cover_url: null,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`   ❌  Failed to insert book: ${insertErr.message}`);
        continue;
      }
      bookId = inserted.id;
      console.log(`   ✓  Book inserted (id: ${bookId})`);
    }

    // 4. Insert chapters — skip any that already exist
    console.log(`\n   ⏳  Inserting ${chapters.length} chapters…\n`);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const ch of chapters) {
      // Check for existing chapter
      const { data: existingCh } = await supabase
        .from("book_chapters")
        .select("id")
        .eq("book_id", bookId)
        .eq("chapter_number", ch.chapter_number)
        .maybeSingle();

      if (existingCh) {
        console.log(`   ⏩  Ch.${ch.chapter_number} already exists — skipping`);
        skipped++;
        continue;
      }

      const { error: chErr } = await supabase.from("book_chapters").insert({
        book_id: bookId,
        chapter_number: ch.chapter_number,
        title: ch.title,
        content: ch.content,
      });

      if (chErr) {
        console.error(`   ❌  Ch.${ch.chapter_number} failed: ${chErr.message}`);
        failed++;
      } else {
        const words = ch.content.split(/\s+/).length;
        console.log(
          `   ✅  Ch.${String(ch.chapter_number).padStart(2, "0")} — ${ch.title} (${words.toLocaleString()} words)`
        );
        inserted++;
      }
    }

    console.log(
      `\n   📊  Summary: ${inserted} inserted · ${skipped} skipped · ${failed} failed`
    );
  }

  console.log("\n\n🎉  Seed complete!\n");
}

seed().catch((err) => {
  console.error("\n💥  Fatal error:", err);
  process.exit(1);
});

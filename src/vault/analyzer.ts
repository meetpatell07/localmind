/**
 * AI file analyzer — scans uploaded files and produces:
 *   - category (one of the predefined list)
 *   - summary (1–2 sentences)
 *   - tags (3–5 keywords)
 *
 * Called async post-upload, never blocks the response.
 */

import { generateObject } from "ai";
import { extractionModel } from "@/agent/ollama";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

export const VAULT_CATEGORIES = [
  "Finance",
  "Code",
  "Documents",
  "Images",
  "Notes",
  "Archive",
  "Media",
  "Design",
  "Data",
  "Other",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

const AnalysisSchema = z.object({
  category: z.enum(VAULT_CATEGORIES),
  summary: z.string().max(300),
  tags: z.array(z.string()).max(6),
});

export type FileAnalysis = z.infer<typeof AnalysisSchema>;

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
]);

const CODE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".cs", ".rb", ".php", ".swift", ".kt",
  ".sh", ".bash", ".zsh", ".yaml", ".yml", ".toml", ".env",
  ".sql", ".graphql", ".json", ".xml", ".html", ".css", ".scss",
  ".md", ".mdx", ".txt", ".csv",
]);

async function readTextPreview(filePath: string, maxChars = 2000): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.slice(0, maxChars);
  } catch {
    return null;
  }
}

export async function analyzeFile(params: {
  fileId: string;
  fileName: string;
  mimeType: string;
  absolutePath: string;
}): Promise<FileAnalysis> {
  const { fileName, mimeType, absolutePath } = params;
  const ext = path.extname(fileName).toLowerCase();

  // Determine if we can read content
  const isReadable =
    TEXT_MIMES.has(mimeType) ||
    mimeType.startsWith("text/") ||
    CODE_EXTS.has(ext);

  const isImage = mimeType.startsWith("image/");

  let contentPreview: string | null = null;
  if (isReadable) {
    contentPreview = await readTextPreview(absolutePath);
  }

  const prompt = buildPrompt(fileName, mimeType, ext, isImage, contentPreview);

  try {
    const { object } = await generateObject({
      model: extractionModel,
      schema: AnalysisSchema,
      prompt,
      temperature: 0,
    });
    return object;
  } catch {
    // Fallback: derive category from mime/ext heuristically
    return {
      category: heuristicCategory(mimeType, ext),
      summary: `File: ${fileName}`,
      tags: [ext.replace(".", "") || "file"],
    };
  }
}

function buildPrompt(
  fileName: string,
  mimeType: string,
  ext: string,
  isImage: boolean,
  content: string | null
): string {
  const parts: string[] = [
    `Analyze this file and return a JSON object with category, summary, and tags.`,
    `\nFile name: ${fileName}`,
    `MIME type: ${mimeType}`,
    `Extension: ${ext || "none"}`,
  ];

  if (isImage) {
    parts.push(`This is an image file.`);
  } else if (content) {
    parts.push(`\nFile content preview (first 2000 chars):\n\`\`\`\n${content}\n\`\`\``);
  }

  parts.push(`
Categories to choose from: Finance, Code, Documents, Images, Notes, Archive, Media, Design, Data, Other

Return:
- category: the most appropriate category
- summary: 1-2 sentences describing what this file is about
- tags: 3-5 lowercase keyword tags relevant to the content`);

  return parts.join("\n");
}

function heuristicCategory(mimeType: string, ext: string): VaultCategory {
  if (mimeType.startsWith("image/")) return "Images";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "Media";
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) return "Documents";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || ext === ".csv") return "Finance";
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gz")) return "Archive";
  const codeExts = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".sql"]);
  if (codeExts.has(ext)) return "Code";
  const dataExts = new Set([".json", ".xml", ".yaml", ".yml", ".csv"]);
  if (dataExts.has(ext)) return "Data";
  if (ext === ".md" || ext === ".txt") return "Notes";
  return "Other";
}

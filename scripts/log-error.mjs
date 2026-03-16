#!/usr/bin/env node

/**
 * Quick Error Logger — log-error.mjs
 * 
 * Quickly append an error entry to the error log.
 * Designed to be called by Claude Code after fixing a bug.
 * 
 * Usage:
 *   node scripts/log-error.mjs --error "TypeError: x is undefined" \
 *     --file "src/agent/client.ts" \
 *     --fix "Added null check on response" \
 *     --category "ollama" \
 *     --lesson "Always null-check Ollama API responses"
 * 
 * Or interactively:
 *   node scripts/log-error.mjs
 */

import { appendFileSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ERROR_LOG = join(__dirname, 'error-log.jsonl');
const LESSONS_FILE = join(__dirname, '..', '.claude', 'rules', 'lessons-learned.md');

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

function logEntry(entry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  
  if (!existsSync(ERROR_LOG)) writeFileSync(ERROR_LOG, '');
  appendFileSync(ERROR_LOG, line + '\n');
  console.log('✅ Error logged to scripts/error-log.jsonl');

  // Also append lesson directly to lessons-learned.md for immediate availability
  if (entry.lesson && entry.category) {
    const cat = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);
    const sectionHeader = `## ${cat} Lessons`;
    let content = existsSync(LESSONS_FILE) ? readFileSync(LESSONS_FILE, 'utf-8') : '';
    
    // Check if lesson already exists
    if (!content.includes(entry.lesson)) {
      if (content.includes(sectionHeader)) {
        // Insert after the section header, replacing "(none yet)" if present
        content = content.replace(
          new RegExp(`(${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n)- \\(none yet\\)`),
          `$1- ${entry.lesson}`
        );
        // If "(none yet)" wasn't there, append after last bullet in that section
        if (!content.includes(entry.lesson)) {
          const sectionIdx = content.indexOf(sectionHeader);
          const nextSectionIdx = content.indexOf('\n## ', sectionIdx + 1);
          const insertIdx = nextSectionIdx === -1 ? content.length : nextSectionIdx;
          content = content.slice(0, insertIdx) + `- ${entry.lesson}\n` + content.slice(insertIdx);
        }
      } else {
        // Add new section
        content += `\n## ${cat} Lessons\n- ${entry.lesson}\n`;
      }
      writeFileSync(LESSONS_FILE, content);
      console.log(`✅ Lesson added to .claude/rules/lessons-learned.md [${cat}]`);
    } else {
      console.log(`ℹ️  Lesson already exists in lessons-learned.md, skipping`);
    }
  }
}

// Parse CLI args
const args = parseArgs(process.argv.slice(2));

if (args.error) {
  logEntry({
    error: args.error,
    file: args.file || 'unknown',
    fix: args.fix || '',
    category: args.category || 'general',
    lesson: args.lesson || '',
  });
} else {
  // Interactive mode
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));
  
  (async () => {
    console.log('🧠 Log an error and lesson\n');
    const error = await ask('Error message: ');
    const file = await ask('File (e.g., src/agent/client.ts): ');
    const fix = await ask('How did you fix it: ');
    const category = await ask('Category (ollama/memory/mcp/dashboard/voice/data/general): ');
    const lesson = await ask('Lesson (concise rule for future): ');
    
    logEntry({ error, file, fix, category: category || 'general', lesson });
    rl.close();
  })();
}

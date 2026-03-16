#!/usr/bin/env node

/**
 * Error Self-Learning System — update-lessons.mjs
 * 
 * Reads error-log.jsonl, groups by category, detects patterns,
 * and updates .claude/rules/lessons-learned.md automatically.
 * 
 * Run: node scripts/update-lessons.mjs
 * 
 * This script is designed to be run by Claude Code after fixing bugs,
 * or manually by the developer. It ensures the CLAUDE.md memory system
 * stays current with all lessons learned from actual errors.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ERROR_LOG = join(ROOT, 'scripts', 'error-log.jsonl');
const LESSONS_FILE = join(ROOT, '.claude', 'rules', 'lessons-learned.md');
const RULES_DIR = join(ROOT, '.claude', 'rules');

// ---- Helpers ----

function readErrorLog() {
  if (!existsSync(ERROR_LOG)) {
    console.log('No error log found. Creating empty log.');
    writeFileSync(ERROR_LOG, '');
    return [];
  }
  const lines = readFileSync(ERROR_LOG, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      console.warn(`Skipping malformed line ${i + 1}`);
      return null;
    }
  }).filter(Boolean);
}

function groupByCategory(entries) {
  const groups = {};
  for (const entry of entries) {
    const cat = (entry.category || 'general').toLowerCase();
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(entry);
  }
  return groups;
}

function extractUniqueLessons(entries) {
  const seen = new Set();
  const lessons = [];
  for (const entry of entries) {
    if (entry.lesson && !seen.has(entry.lesson)) {
      seen.add(entry.lesson);
      lessons.push(entry.lesson);
    }
  }
  return lessons;
}

function readExistingLessons() {
  if (!existsSync(LESSONS_FILE)) return '';
  return readFileSync(LESSONS_FILE, 'utf-8');
}

function buildLessonsMarkdown(grouped) {
  const categoryMap = {
    database: 'Database Lessons',
    ollama: 'Ollama Lessons',
    memory: 'Memory Lessons',
    mcp: 'MCP Lessons',
    dashboard: 'Dashboard Lessons',
    voice: 'Voice Lessons',
    vault: 'Vault Lessons',
    general: 'General Lessons',
  };

  let md = `# Lessons Learned (Auto-Updated)\n\n`;
  md += `> This file is automatically updated by the error self-learning system.\n`;
  md += `> Claude Code loads this at every session start.\n`;
  md += `> Each lesson is a concise rule derived from actual bugs encountered and fixed.\n`;
  md += `> Last updated: ${new Date().toISOString()}\n\n`;

  for (const [cat, title] of Object.entries(categoryMap)) {
    md += `## ${title}\n`;
    const entries = grouped[cat] || [];
    const lessons = extractUniqueLessons(entries);
    if (lessons.length === 0) {
      md += `- (none yet)\n`;
    } else {
      for (const lesson of lessons) {
        md += `- ${lesson}\n`;
      }
    }
    md += `\n`;
  }

  // Handle any categories not in the predefined list
  for (const [cat, entries] of Object.entries(grouped)) {
    if (!(cat in categoryMap)) {
      md += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)} Lessons\n`;
      const lessons = extractUniqueLessons(entries);
      for (const lesson of lessons) {
        md += `- ${lesson}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

function detectPatterns(grouped) {
  const patterns = [];
  for (const [cat, entries] of Object.entries(grouped)) {
    // Group by similar error messages (first 50 chars)
    const errorGroups = {};
    for (const e of entries) {
      const key = (e.error || '').slice(0, 50);
      if (!errorGroups[key]) errorGroups[key] = [];
      errorGroups[key].push(e);
    }
    
    for (const [errorKey, group] of Object.entries(errorGroups)) {
      if (group.length >= 3) {
        patterns.push({
          category: cat,
          count: group.length,
          error: errorKey,
          lesson: group[group.length - 1].lesson || 'No lesson recorded',
          fixes: group.map(g => g.fix).filter(Boolean),
        });
      }
    }
  }
  return patterns;
}

// ---- Main ----

function main() {
  console.log('🧠 Error Self-Learning System\n');
  
  const entries = readErrorLog();
  console.log(`📋 Found ${entries.length} error log entries`);
  
  if (entries.length === 0) {
    console.log('No errors logged yet. Lessons file is up to date.');
    return;
  }

  const grouped = groupByCategory(entries);
  const categories = Object.keys(grouped);
  console.log(`📂 Categories: ${categories.join(', ')}`);

  // Update lessons-learned.md
  const newLessons = buildLessonsMarkdown(grouped);
  writeFileSync(LESSONS_FILE, newLessons);
  console.log(`✅ Updated ${LESSONS_FILE}`);

  // Detect patterns (3+ similar errors)
  const patterns = detectPatterns(grouped);
  if (patterns.length > 0) {
    console.log(`\n⚠️  Detected ${patterns.length} recurring pattern(s):\n`);
    for (const p of patterns) {
      console.log(`  [${p.category}] "${p.error}..." (${p.count} occurrences)`);
      console.log(`    Lesson: ${p.lesson}`);
      console.log(`    → Consider promoting to .claude/rules/${p.category}.md\n`);
    }
  } else {
    console.log('\n✅ No recurring patterns detected (all errors unique so far)');
  }

  // Summary
  const totalLessons = Object.values(grouped).reduce((sum, g) => sum + extractUniqueLessons(g).length, 0);
  console.log(`\n📊 Summary: ${totalLessons} unique lessons across ${categories.length} categories`);
  console.log('Done! Claude Code will load updated lessons on next session.\n');
}

main();

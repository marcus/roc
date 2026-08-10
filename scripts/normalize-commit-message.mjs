#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_COMMENT_PREFIX = '#';
const AUTO_COMMENT_PREFIX = 'auto';
const CONVENTIONAL_PREFIX =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\([^)]+\))?!?:\s*/i;
const SIMPLE_LOWERCASE_LEADING_WORD = /^\p{Ll}+(?:['’-]\p{Ll}+)*$/u;
const AUTO_COMMENT_PREFIX_PATTERN = /^([^\p{L}\p{N}\s]+)(?:\s|$)/u;

export function shouldSkipSubject(subject) {
  const trimmedSubject = subject.trim();

  return (
    /^Merge\b/.test(trimmedSubject) ||
    /^Revert\b/.test(trimmedSubject) ||
    /^(fixup!|squash!)/.test(trimmedSubject)
  );
}

export function capitalizeLeadingWord(subject) {
  const leadingToken = subject.match(/^\S+/u)?.[0];

  if (!leadingToken || !SIMPLE_LOWERCASE_LEADING_WORD.test(leadingToken)) {
    return subject;
  }

  return subject.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
}

export function normalizeSubject(subject) {
  const compactSubject = subject.trim().replace(/\s+/g, ' ');

  if (!compactSubject || shouldSkipSubject(compactSubject)) {
    return compactSubject;
  }

  let normalizedSubject = compactSubject.replace(CONVENTIONAL_PREFIX, '').trim();
  normalizedSubject = normalizedSubject.replace(/\s+/g, ' ');
  normalizedSubject = normalizedSubject.replace(/[.!]+$/u, '');
  normalizedSubject = capitalizeLeadingWord(normalizedSubject);

  return normalizedSubject || compactSubject;
}

export function inferCommentPrefix(message) {
  const candidates = new Map();

  for (const rawLine of message.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const match = line.match(AUTO_COMMENT_PREFIX_PATTERN);

    if (!match) {
      continue;
    }

    const prefix = match[1];
    const candidate = candidates.get(prefix) ?? { count: 0, hasStandaloneLine: false };

    candidate.count += 1;
    candidate.hasStandaloneLine ||= line === prefix;
    candidates.set(prefix, candidate);
  }

  let bestMatch = null;

  for (const [prefix, candidate] of candidates) {
    if (!candidate.hasStandaloneLine || candidate.count < 2) {
      continue;
    }

    if (
      !bestMatch ||
      candidate.count > bestMatch.count ||
      (candidate.count === bestMatch.count && prefix.length > bestMatch.prefix.length)
    ) {
      bestMatch = { prefix, count: candidate.count };
    }
  }

  return bestMatch?.prefix ?? null;
}

export function resolveCommentPrefix(configuredCommentPrefix, message) {
  if (!configuredCommentPrefix) {
    return DEFAULT_COMMENT_PREFIX;
  }

  if (configuredCommentPrefix === AUTO_COMMENT_PREFIX) {
    return inferCommentPrefix(message);
  }

  return configuredCommentPrefix;
}

export function findSubjectLine(message, options = {}) {
  const commentPrefix = resolveCommentPrefix(options.commentPrefix, message);
  let offset = 0;

  while (offset <= message.length) {
    const newlineIndex = message.indexOf('\n', offset);
    const lineEnd = newlineIndex === -1 ? message.length : newlineIndex;
    const rawLine = message.slice(offset, lineEnd);
    const hasCarriageReturn = rawLine.endsWith('\r');
    const line = hasCarriageReturn ? rawLine.slice(0, -1) : rawLine;
    const trimmedLine = line.trim();

    if (trimmedLine && !(commentPrefix && line.startsWith(commentPrefix))) {
      return {
        start: offset,
        end: lineEnd,
        line,
        hasCarriageReturn,
        subject: trimmedLine,
      };
    }

    if (newlineIndex === -1) {
      break;
    }

    offset = newlineIndex + 1;
  }

  return null;
}

export function normalizeMessage(message, options = {}) {
  const subjectLine = findSubjectLine(message, options);

  if (!subjectLine || shouldSkipSubject(subjectLine.subject)) {
    return message;
  }

  const normalizedSubject = normalizeSubject(subjectLine.subject);

  if (!normalizedSubject || normalizedSubject === subjectLine.line) {
    return message;
  }

  const carriageReturn = subjectLine.hasCarriageReturn ? '\r' : '';

  return `${message.slice(0, subjectLine.start)}${normalizedSubject}${carriageReturn}${message.slice(subjectLine.end)}`;
}

async function readGitConfigValue(key) {
  try {
    const { stdout } = await execFile('git', ['config', '--get', key], {
      cwd: REPO_ROOT,
    });

    return stdout.trim();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      return '';
    }

    throw error;
  }
}

export async function readConfiguredCommentPrefix() {
  const commentString = await readGitConfigValue('core.commentString');

  if (commentString) {
    return commentString;
  }

  const commentChar = await readGitConfigValue('core.commentChar');

  if (commentChar) {
    return commentChar;
  }

  return null;
}

export async function normalizeMessageFile(filePath) {
  const originalMessage = await readFile(filePath, 'utf8');
  const configuredCommentPrefix = await readConfiguredCommentPrefix();
  const normalizedMessage = normalizeMessage(originalMessage, {
    commentPrefix: configuredCommentPrefix,
  });

  if (normalizedMessage !== originalMessage) {
    await writeFile(filePath, normalizedMessage, 'utf8');
    return true;
  }

  return false;
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node scripts/normalize-commit-message.mjs <commit-message-file>');
    process.exitCode = 1;
    return;
  }

  await normalizeMessageFile(filePath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

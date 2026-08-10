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
const AUTO_COMMENT_PREFIX_PATTERN =
  /^([^\p{L}\p{N}\s]+)\s*Please enter (?:the commit message for your changes|a commit message to explain why this merge is necessary)\b/iu;
const GIT_COMMENT_BLOCK_HEADER =
  /^Please enter (?:the commit message for your changes|a commit message to explain why this merge is necessary)\b/i;
const GIT_COMMENT_BLOCK_CONTINUATION =
  /^(?:Lines starting with\b|with ['"`].+['"`] will be ignored, and an empty message aborts the commit\.)/i;
const GIT_COMMENT_BLOCK_METADATA =
  /^(?:On branch\b|Your branch is\b|Changes to be committed:|Changes not staged for commit:|Untracked files:|Last command done\b|Next command to do\b|No commands done\b|You are currently rebasing\b|You are currently cherry-picking\b|You are currently bisecting\b|interactive rebase in progress\b|All conflicts fixed but you are still merging\b|All conflicts fixed but you are still cherry-picking\b|Conflicts:\b|nothing to commit\b)/i;

function getLineRecords(message) {
  const lines = [];
  let offset = 0;

  while (offset <= message.length) {
    const newlineIndex = message.indexOf('\n', offset);
    const lineEnd = newlineIndex === -1 ? message.length : newlineIndex;
    const rawLine = message.slice(offset, lineEnd);
    const hasCarriageReturn = rawLine.endsWith('\r');
    const line = hasCarriageReturn ? rawLine.slice(0, -1) : rawLine;

    lines.push({
      start: offset,
      end: lineEnd,
      line,
      trimmedLine: line.trim(),
      hasCarriageReturn,
    });

    if (newlineIndex === -1) {
      break;
    }

    offset = newlineIndex + 1;
  }

  return lines;
}

function stripCommentPrefix(line, commentPrefix) {
  if (!commentPrefix || !line.startsWith(commentPrefix)) {
    return null;
  }

  const rest = line.slice(commentPrefix.length);
  return rest.startsWith(' ') ? rest.slice(1) : rest;
}

function hasGitCommentBlockEvidence(lines, startIndex, commentPrefix) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const content = stripCommentPrefix(lines[index].line, commentPrefix);

    if (content === null) {
      if (!lines[index].trimmedLine) {
        continue;
      }

      break;
    }

    if (!content || GIT_COMMENT_BLOCK_CONTINUATION.test(content)) {
      continue;
    }

    if (GIT_COMMENT_BLOCK_METADATA.test(content)) {
      return true;
    }
  }

  return false;
}

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
  const lines = getLineRecords(message);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].line.match(AUTO_COMMENT_PREFIX_PATTERN);

    if (!match) {
      continue;
    }

    const prefix = match[1];

    if (hasGitCommentBlockEvidence(lines, index + 1, prefix)) {
      return prefix;
    }
  }

  return null;
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

export function findGitCommentBlockStart(message, commentPrefix) {
  if (!commentPrefix) {
    return null;
  }

  const lines = getLineRecords(message);

  for (let index = 0; index < lines.length; index += 1) {
    const content = stripCommentPrefix(lines[index].line, commentPrefix);

    if (content === null || !GIT_COMMENT_BLOCK_HEADER.test(content)) {
      continue;
    }

    if (!hasGitCommentBlockEvidence(lines, index + 1, commentPrefix)) {
      continue;
    }

    return lines[index].start;
  }

  return null;
}

export function findSubjectLine(message, options = {}) {
  const commentPrefix = resolveCommentPrefix(options.commentPrefix, message);
  const commentBlockStart = findGitCommentBlockStart(message, commentPrefix);
  const lines = getLineRecords(message);

  for (const line of lines) {
    if (commentBlockStart !== null && line.start >= commentBlockStart) {
      break;
    }

    if (!line.trimmedLine) {
      continue;
    }

    return {
      start: line.start,
      end: line.end,
      line: line.line,
      hasCarriageReturn: line.hasCarriageReturn,
      subject: line.trimmedLine,
    };
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

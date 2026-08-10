#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const COMMENT_PREFIX = '#';
const CONVENTIONAL_PREFIX =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\([^)]+\))?!?:\s*/i;

export function shouldSkipSubject(subject) {
  const trimmedSubject = subject.trim();

  return (
    /^Merge\b/.test(trimmedSubject) ||
    /^Revert\b/.test(trimmedSubject) ||
    /^(fixup!|squash!)/.test(trimmedSubject)
  );
}

export function normalizeSubject(subject) {
  const compactSubject = subject.trim().replace(/\s+/g, ' ');

  if (!compactSubject || shouldSkipSubject(compactSubject)) {
    return compactSubject;
  }

  let normalizedSubject = compactSubject.replace(CONVENTIONAL_PREFIX, '').trim();
  normalizedSubject = normalizedSubject.replace(/\s+/g, ' ');
  normalizedSubject = normalizedSubject.replace(/[.!]+$/u, '');
  normalizedSubject = normalizedSubject.replace(
    /^([^\p{L}]*)(\p{Ll})/u,
    (_, prefix, letter) => prefix + letter.toUpperCase(),
  );

  return normalizedSubject || compactSubject;
}

export function findSubjectLine(message) {
  let offset = 0;

  while (offset <= message.length) {
    const newlineIndex = message.indexOf('\n', offset);
    const lineEnd = newlineIndex === -1 ? message.length : newlineIndex;
    const rawLine = message.slice(offset, lineEnd);
    const hasCarriageReturn = rawLine.endsWith('\r');
    const line = hasCarriageReturn ? rawLine.slice(0, -1) : rawLine;
    const trimmedLine = line.trim();

    if (trimmedLine && !trimmedLine.startsWith(COMMENT_PREFIX)) {
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

export function normalizeMessage(message) {
  const subjectLine = findSubjectLine(message);

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

export async function normalizeMessageFile(filePath) {
  const originalMessage = await readFile(filePath, 'utf8');
  const normalizedMessage = normalizeMessage(originalMessage);

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

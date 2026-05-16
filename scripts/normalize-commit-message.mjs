#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VALID_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'style',
  'test',
];

const TYPE_ALIASES = new Map([
  ['build', 'build'],
  ['chore', 'chore'],
  ['ci', 'ci'],
  ['doc', 'docs'],
  ['docs', 'docs'],
  ['documentation', 'docs'],
  ['feat', 'feat'],
  ['feature', 'feat'],
  ['fix', 'fix'],
  ['bugfix', 'fix'],
  ['perf', 'perf'],
  ['refactor', 'refactor'],
  ['style', 'style'],
  ['test', 'test'],
  ['tests', 'test'],
]);

const EXEMPT_PATTERNS = [
  /^Merge\b/,
  /^Revert\b/,
  /^(fixup|squash)! /,
];

const FEATURE_VERBS = new Set([
  'add',
  'allow',
  'create',
  'emit',
  'enable',
  'expose',
  'extract',
  'generate',
  'implement',
  'introduce',
  'make',
  'move',
  'normalize',
  'rename',
  'ship',
  'standardize',
  'support',
  'update',
]);

const LOWERCASEABLE_WORDS = new Set([
  'add',
  'allow',
  'backfill',
  'build',
  'bump',
  'clean',
  'cleanup',
  'clarify',
  'create',
  'document',
  'docs',
  'emit',
  'enable',
  'expose',
  'extract',
  'fix',
  'format',
  'formatting',
  'generate',
  'implement',
  'improve',
  'introduce',
  'make',
  'move',
  'normalize',
  'optimize',
  'refactor',
  'remove',
  'rename',
  'repair',
  'resolve',
  'ship',
  'standardize',
  'support',
  'test',
  'tidy',
  'update',
  'write',
]);

const SUGGESTION_RULES = [
  {
    type: 'docs',
    test: (lower) =>
      /^(backfill|clarify|document|docs?|readme|spec|write)\b/.test(lower) ||
      /\b(readme|docs?|documentation|guide|spec)\b/.test(lower),
  },
  {
    type: 'fix',
    test: (lower) => /^(fix|correct|handle|patch|prevent|repair|resolve|restore)\b/.test(lower),
  },
  {
    type: 'refactor',
    test: (lower) => /^(refactor|restructure|simplify)\b/.test(lower),
  },
  {
    type: 'test',
    test: (lower) => /^(test|cover|verify)\b/.test(lower),
  },
  {
    type: 'build',
    test: (lower) => /^(build|bundle|compile|package)\b/.test(lower),
  },
  {
    type: 'ci',
    test: (lower) => /^(ci|workflow)\b/.test(lower) || lower.includes('github action'),
  },
  {
    type: 'perf',
    test: (lower) => /^(optimi[sz]e|perf|speed)\b/.test(lower),
  },
  {
    type: 'chore',
    test: (lower) => /^(bump|clean ?up|cleanup|format|formatting|release|tidy)\b/.test(lower),
  },
  {
    type: 'feat',
    test: (lower) => FEATURE_VERBS.has(lower.split(/\s+/, 1)[0]),
  },
];

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function stripTrailingPeriods(value) {
  return value.replace(/\.+$/, '');
}

function extractTaskSuffix(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(?:\s*\((td-[a-z0-9]+)\)\s*)$/i);

  if (!match) {
    return {
      core: trimmed,
      taskSuffix: '',
    };
  }

  return {
    core: match[1].trim(),
    taskSuffix: ` (${match[2].toLowerCase()})`,
  };
}

function lowercaseLeadingWord(summary) {
  const match = summary.match(/^([A-Za-z]+)(\b.*)$/);
  if (!match) {
    return summary;
  }

  const [, firstWord, rest] = match;
  if (!LOWERCASEABLE_WORDS.has(firstWord.toLowerCase())) {
    return summary;
  }

  return `${firstWord.toLowerCase()}${rest}`;
}

function normalizeSummary(summary) {
  const { core, taskSuffix } = extractTaskSuffix(summary);
  const cleanedSummary = lowercaseLeadingWord(
    stripTrailingPeriods(normalizeWhitespace(core)),
  );

  return {
    summary: cleanedSummary,
    taskSuffix,
  };
}

function inferType(summary) {
  const lowerSummary = summary.toLowerCase();
  for (const rule of SUGGESTION_RULES) {
    if (rule.test(lowerSummary)) {
      return rule.type;
    }
  }
  return null;
}

function formatMissingTypeError(suggestion) {
  const lines = [
    'Commit subject must use "<type>: <imperative summary>".',
    `Allowed types: ${VALID_TYPES.join(', ')}.`,
  ];

  if (suggestion) {
    lines.push(`Suggested subject: ${suggestion}`);
  } else {
    lines.push('Examples: feat: add icon export, docs: update contributing guide, chore: format demo page');
  }

  return lines.join('\n');
}

function isExemptSubject(subject) {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(subject));
}

function buildSuggestion(rawSubject) {
  const { summary, taskSuffix } = normalizeSummary(rawSubject);
  if (!summary) {
    return null;
  }

  const inferredType = inferType(summary);
  if (!inferredType) {
    return null;
  }

  return `${inferredType}: ${summary}${taskSuffix}`;
}

export function normalizeCommitSubject(subject) {
  const trimmedSubject = subject.trim();
  if (!trimmedSubject) {
    return {
      ok: false,
      error: formatMissingTypeError(null),
      suggestion: null,
    };
  }

  if (isExemptSubject(trimmedSubject)) {
    return {
      ok: true,
      exempt: true,
      subject: trimmedSubject,
    };
  }

  const typedMatch = trimmedSubject.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
  if (!typedMatch) {
    const suggestion = buildSuggestion(trimmedSubject);
    return {
      ok: false,
      error: formatMissingTypeError(suggestion),
      suggestion,
    };
  }

  const rawType = typedMatch[1];
  const canonicalType = TYPE_ALIASES.get(rawType.toLowerCase());
  if (!canonicalType) {
    return {
      ok: false,
      error: `Unsupported commit type "${rawType.toLowerCase()}". Allowed types: ${VALID_TYPES.join(', ')}.`,
      suggestion: null,
    };
  }

  const { summary, taskSuffix } = normalizeSummary(typedMatch[2]);
  if (!summary) {
    return {
      ok: false,
      error: 'Commit subject is missing a summary. Use "<type>: <imperative summary>".',
      suggestion: null,
    };
  }

  return {
    ok: true,
    exempt: false,
    subject: `${canonicalType}: ${summary}${taskSuffix}`,
  };
}

function findSubjectIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    return index;
  }

  return -1;
}

export function normalizeCommitMessageText(message) {
  const newline = message.includes('\r\n') ? '\r\n' : '\n';
  const lines = message.split(/\r?\n/);
  const subjectIndex = findSubjectIndex(lines);

  if (subjectIndex === -1) {
    return {
      ok: false,
      error: formatMissingTypeError(null),
      suggestion: null,
    };
  }

  const subjectResult = normalizeCommitSubject(lines[subjectIndex]);
  if (!subjectResult.ok) {
    return subjectResult;
  }

  lines[subjectIndex] = subjectResult.subject;

  return {
    ok: true,
    changed: lines.join(newline) !== message,
    exempt: subjectResult.exempt,
    subject: subjectResult.subject,
    message: lines.join(newline),
  };
}

export function normalizeCommitMessageFile(messagePath) {
  const rawMessage = fs.readFileSync(messagePath, 'utf8');
  const result = normalizeCommitMessageText(rawMessage);

  if (result.ok && result.changed) {
    fs.writeFileSync(messagePath, result.message);
  }

  return result;
}

function runCli() {
  const messagePath = process.argv[2];
  if (!messagePath) {
    console.error('Usage: node scripts/normalize-commit-message.mjs <commit-message-file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), messagePath);
  const result = normalizeCommitMessageFile(absolutePath);

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.changed) {
    console.log(`Normalized commit subject: ${result.subject}`);
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  runCli();
}

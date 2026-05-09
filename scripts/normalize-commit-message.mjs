#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const INFERRED_COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'build',
  'test',
  'refactor',
  'chore',
];

export const RECOGNIZED_COMMIT_TYPES = [
  ...INFERRED_COMMIT_TYPES,
  'ci',
  'perf',
  'style',
];

const TYPE_ALIASES = new Map([
  ['doc', 'docs'],
  ['docs', 'docs'],
  ['documentation', 'docs'],
  ['feature', 'feat'],
  ['feat', 'feat'],
  ['fix', 'fix'],
  ['bugfix', 'fix'],
  ['build', 'build'],
  ['bundle', 'build'],
  ['test', 'test'],
  ['tests', 'test'],
  ['refactor', 'refactor'],
  ['chore', 'chore'],
]);

const FEATURE_VERBS = new Set([
  'add',
  'allow',
  'create',
  'emit',
  'enable',
  'expose',
  'generate',
  'implement',
  'introduce',
  'make',
  'more',
  'move',
  'normalize',
  'rename',
  'ship',
  'standardize',
  'support',
  'update',
]);

const LOWERCASEABLE_LEADING_WORDS = new Set([
  ...FEATURE_VERBS,
  'backfill',
  'build',
  'bump',
  'clean',
  'cleanup',
  'clarify',
  'cover',
  'document',
  'fix',
  'format',
  'improve',
  'optimize',
  'package',
  'patch',
  'prevent',
  'refresh',
  'refactor',
  'remove',
  'repair',
  'resolve',
  'restore',
  'simplify',
  'test',
  'tidy',
  'verify',
  'write',
]);

const INFERENCE_RULES = [
  {
    type: 'fix',
    test: (lower) =>
      /^(fix|correct|handle|patch|prevent|repair|resolve|restore)\b/.test(lower) ||
      /\b(bug|fix|fixed|fixes|regression|compatibility)\b/.test(lower),
  },
  {
    type: 'docs',
    test: (lower) =>
      /^(backfill|clarify|document|docs?|readme|spec|write)\b/.test(lower) ||
      /\b(readme|docs?|documentation|guide|spec)\b/.test(lower),
  },
  {
    type: 'test',
    test: (lower) => /^(test|cover|verify)\b/.test(lower),
  },
  {
    type: 'build',
    test: (lower) =>
      /^(build|bundle|compile|package)\b/.test(lower) ||
      /\b(build|script|pipeline|codegen|types|type declarations|package|exports|automation|watch)\b/.test(lower),
  },
  {
    type: 'refactor',
    test: (lower) => /^(refactor|restructure|simplify)\b/.test(lower),
  },
  {
    type: 'chore',
    test: (lower) => /^(bump|clean ?up|cleanup|format|formatting|release|tidy)\b/.test(lower),
  },
  {
    type: 'feat',
    scope: 'icons',
    test: (lower) =>
      /\b(icon|icons|logo|logos|sprite|sprites|metadata|category|categories|glyph|glyphs)\b/.test(lower),
  },
  {
    type: 'feat',
    test: (lower) => FEATURE_VERBS.has(lower.split(/\s+/, 1)[0]),
  },
];

const CONVENTIONAL_SUBJECT_PATTERN =
  /^([A-Za-z][A-Za-z0-9-]*)(?:\s*\(\s*([^)]+?)\s*\))?(!)?\s*:\s*(.*)$/;

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripTrailingPeriods(value) {
  return value.replace(/\.+$/u, '');
}

function normalizeScope(scope) {
  return normalizeWhitespace(scope)
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function normalizeType(type) {
  const lowerType = normalizeWhitespace(type).toLowerCase();
  return TYPE_ALIASES.get(lowerType) || lowerType;
}

export function isRecognizedCommitType(type) {
  return RECOGNIZED_COMMIT_TYPES.includes(normalizeType(type));
}

function splitTaskSuffix(summary) {
  const match = summary.match(/^(.*?)(?:\s+\((td-[a-z0-9-]+)\))$/i);
  if (!match) {
    return {
      summary,
      taskSuffix: '',
    };
  }

  return {
    summary: match[1].trim(),
    taskSuffix: ` (${match[2].toLowerCase()})`,
  };
}

function normalizeSummary(summary) {
  const normalized = normalizeWhitespace(summary);
  const normalizedWithoutFinalPeriod = stripTrailingPeriods(normalized).trim();
  const { summary: summaryWithoutTask, taskSuffix } = splitTaskSuffix(normalizedWithoutFinalPeriod);
  const summaryWithoutPeriod = stripTrailingPeriods(summaryWithoutTask).trim();
  const withLowercaseVerb = lowercaseLeadingWord(summaryWithoutPeriod);

  return `${withLowercaseVerb}${taskSuffix}`.trim();
}

export function normalizeCommitSummary(summary) {
  return normalizeSummary(summary);
}

function lowercaseLeadingWord(summary) {
  const match = summary.match(/^([A-Za-z]+)(\b.*)$/);
  if (!match) {
    return summary;
  }

  const [, leadingWord, rest] = match;
  if (!LOWERCASEABLE_LEADING_WORDS.has(leadingWord.toLowerCase())) {
    return summary;
  }

  return `${leadingWord.toLowerCase()}${rest}`;
}

function inferCommitDescriptor(summary) {
  const lower = summary.toLowerCase();
  for (const rule of INFERENCE_RULES) {
    if (rule.test(lower)) {
      return {
        type: rule.type,
        scope: rule.scope || '',
      };
    }
  }

  return {
    type: 'chore',
    scope: '',
  };
}

function parseAnyConventionalSubject(subject) {
  const normalized = normalizeWhitespace(subject);
  const match = normalized.match(CONVENTIONAL_SUBJECT_PATTERN);
  if (!match) {
    return null;
  }

  const [, rawType, rawScope = '', breaking = '', rawSummary] = match;
  const summary = normalizeSummary(rawSummary);
  if (!summary) {
    return null;
  }

  return {
    type: normalizeType(rawType),
    scope: rawScope ? normalizeScope(rawScope) : '',
    breaking: breaking === '!',
    summary,
  };
}

export function parseConventionalSubject(subject) {
  const conventional = parseAnyConventionalSubject(subject);
  if (!conventional || !isRecognizedCommitType(conventional.type)) {
    return null;
  }

  return conventional;
}

export function formatConventionalSubject({ type, scope = '', breaking = false, summary }) {
  const scopeText = scope ? `(${normalizeScope(scope)})` : '';
  const breakingText = breaking ? '!' : '';

  return `${normalizeType(type)}${scopeText}${breakingText}: ${normalizeSummary(summary)}`;
}

export function normalizeCommitSubject(subject) {
  const conventional = parseAnyConventionalSubject(subject);
  if (conventional) {
    if (!isRecognizedCommitType(conventional.type)) {
      const inferred = inferCommitDescriptor(conventional.summary);
      return formatConventionalSubject({
        ...inferred,
        scope: conventional.scope || inferred.scope,
        breaking: conventional.breaking,
        summary: conventional.summary,
      });
    }

    return formatConventionalSubject(conventional);
  }

  const summary = normalizeSummary(subject);
  if (!summary) {
    return '';
  }

  return formatConventionalSubject({
    ...inferCommitDescriptor(summary),
    summary,
  });
}

export function cleanCommitSubjectSummary(subject) {
  const normalized = normalizeCommitSubject(subject);
  const conventional = parseConventionalSubject(normalized);
  if (!conventional) {
    return normalizeSummary(subject);
  }

  const { summary } = splitTaskSuffix(conventional.summary);
  return summary;
}

export function checkCommitSubject(subject) {
  const normalized = normalizeCommitSubject(subject);
  const ok = normalized.length > 0 && subject === normalized;

  return {
    ok,
    normalized,
    changed: normalized !== subject,
  };
}

function findSubjectLineIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    return index;
  }

  return -1;
}

export function normalizeCommitMessage(message) {
  const newline = message.includes('\r\n') ? '\r\n' : '\n';
  const lines = String(message ?? '').split(/\r?\n/u);
  const subjectIndex = findSubjectLineIndex(lines);

  if (subjectIndex === -1) {
    return '';
  }

  lines[subjectIndex] = normalizeCommitSubject(lines[subjectIndex]);
  return lines.join(newline);
}

export function checkCommitMessage(message) {
  const normalized = normalizeCommitMessage(message);
  const ok = normalized.length > 0 && message === normalized;

  return {
    ok,
    normalized,
    changed: normalized !== message,
  };
}

function parseArgs(argv) {
  const options = {
    check: false,
    help: false,
    subjectParts: [],
    writePath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    if (token === '--check') {
      options.check = true;
      continue;
    }

    if (token === '--write') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --write.');
      }
      options.writePath = value;
      index += 1;
      continue;
    }

    options.subjectParts.push(token);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/normalize-commit-message.mjs [--check] [subject...]
       node scripts/normalize-commit-message.mjs [--check] < message.txt
       node scripts/normalize-commit-message.mjs --write <path>

Options:
  --check        Validate instead of printing normalized output
  --write <path> Normalize the first non-comment subject line in a commit message file
  --help, -h     Show this help message
`);
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function failCheck(kind, normalized) {
  console.error(`${kind} is not normalized.`);
  if (normalized) {
    console.error(`Expected: ${normalized}`);
  }
  process.exitCode = 1;
}

function failMissingSubject(kind) {
  console.error(`${kind} is missing a subject.`);
  process.exitCode = 1;
}

function runCli() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    if (options.writePath) {
      const messagePath = path.resolve(options.writePath);
      const message = fs.readFileSync(messagePath, 'utf8');
      const result = checkCommitMessage(message);
      if (!result.normalized) {
        failMissingSubject('Commit message');
        return;
      }
      if (options.check) {
        if (!result.ok) {
          failCheck('Commit message', result.normalized);
        }
        return;
      }

      fs.writeFileSync(messagePath, result.normalized);
      return;
    }

    if (options.subjectParts.length > 0) {
      const subject = options.subjectParts.join(' ');
      const result = checkCommitSubject(subject);
      if (!result.normalized) {
        failMissingSubject('Commit subject');
        return;
      }
      if (options.check) {
        if (!result.ok) {
          failCheck('Commit subject', result.normalized);
        }
        return;
      }

      process.stdout.write(`${result.normalized}\n`);
      return;
    }

    const message = readStdin();
    const result = checkCommitMessage(message);
    if (!result.normalized) {
      failMissingSubject('Commit message');
      return;
    }
    if (options.check) {
      if (!result.ok) {
        failCheck('Commit message', result.normalized);
      }
      return;
    }

    process.stdout.write(result.normalized);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCli();
}

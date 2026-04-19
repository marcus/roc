#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTION_ORDER = [
  'Features',
  'Fixes',
  'Documentation',
  'Build & Tooling',
  'Icons',
  'Other Changes',
];

const SECTION_DESCRIPTIONS = {
  Features: 'Product and developer-facing improvements.',
  Fixes: 'Bug fixes and compatibility updates.',
  Documentation: 'Documentation and contributor guidance changes.',
  'Build & Tooling': 'Build, packaging, and automation work.',
  Icons: 'Icon additions, redesigns, and metadata updates.',
  'Other Changes': 'Changes that do not match a more specific section.',
};

export function parseArgs(argv) {
  const options = {
    from: '',
    to: 'HEAD',
    range: '',
    output: '',
    limit: 0,
    repo: process.cwd(),
    title: 'Changelog',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    if (token === '--from') {
      options.from = expectValue(argv, ++index, token);
      continue;
    }

    if (token === '--to') {
      options.to = expectValue(argv, ++index, token);
      continue;
    }

    if (token === '--range') {
      options.range = expectValue(argv, ++index, token);
      continue;
    }

    if (token === '--output' || token === '-o') {
      options.output = expectValue(argv, ++index, token);
      continue;
    }

    if (token === '--limit') {
      const raw = expectValue(argv, ++index, token);
      options.limit = Number.parseInt(raw, 10);
      if (!Number.isInteger(options.limit) || options.limit < 1) {
        throw new Error(`Expected a positive integer for ${token}, received "${raw}".`);
      }
      continue;
    }

    if (token === '--repo') {
      options.repo = path.resolve(expectValue(argv, ++index, token));
      continue;
    }

    if (token === '--title') {
      options.title = expectValue(argv, ++index, token);
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (options.range && (options.from || options.to !== 'HEAD')) {
    throw new Error('Use either --range or --from/--to, not both.');
  }

  return options;
}

function expectValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

export function getGitRange(options) {
  if (options.range) {
    return options.range;
  }

  if (options.from) {
    return `${options.from}..${options.to || 'HEAD'}`;
  }

  return options.to || 'HEAD';
}

export function readGitCommits(options = {}) {
  const repo = options.repo || process.cwd();
  const range = getGitRange(options);
  const gitArgs = [
    '-C',
    repo,
    'log',
    '--date=short',
    '--pretty=format:%H%x1f%h%x1f%s%x1f%ad',
    range,
  ];

  if (options.limit) {
    gitArgs.splice(gitArgs.length, 0, `--max-count=${options.limit}`);
  }

  const raw = execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  if (!raw) {
    return [];
  }

  return raw.split('\n').filter(Boolean).map((line) => {
    const [hash, shortHash, subject, date] = line.split('\x1f');
    return {
      hash,
      shortHash,
      subject: subject.trim(),
      date,
    };
  });
}

export function normalizeSubject(subject) {
  return subject.replace(/\s+/g, ' ').trim();
}

export function cleanSubject(subject) {
  return normalizeSubject(subject)
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .replace(/\s+\((td-[^)]+)\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyCommit(subject) {
  const normalized = normalizeSubject(subject);
  const lower = normalized.toLowerCase();
  const conventionalMatch = lower.match(/^([a-z]+)(\([^)]+\))?!?:\s/);
  const conventionalType = conventionalMatch?.[1] || '';

  if (conventionalType === 'feat') {
    return 'Features';
  }

  if (conventionalType === 'fix' || conventionalType === 'perf'
    || /\b(fix|fixed|fixes|bug|compatibility)\b/.test(lower)) {
    return 'Fixes';
  }

  if (/\b(icon|icons|logo|logos|brand|brands|sprite|metadata|category|categories|redesign)\b/.test(lower)) {
    return 'Icons';
  }

  if (conventionalType === 'docs' || /\b(readme|docs?|documentation|guide)\b/.test(lower)) {
    return 'Documentation';
  }

  if (conventionalType && ['build', 'chore', 'ci', 'test', 'refactor'].includes(conventionalType)) {
    return 'Build & Tooling';
  }

  if (/\b(build|script|pipeline|codegen|types|type declarations|package|exports|automation|watch|gitignore|tracking)\b/.test(lower)) {
    return 'Build & Tooling';
  }

  if (/^(add|adds|added|create|creates|created|implement|implements|implemented|introduce|introduces|introduced|support|supports|supported|allow|allows|allowed|enable|enables|enabled|ship|ships|shipped)\b/.test(lower)) {
    return 'Features';
  }

  return 'Other Changes';
}

export function buildSections(commits) {
  const sections = new Map(SECTION_ORDER.map((section) => [section, []]));

  for (const commit of commits) {
    const section = classifyCommit(commit.subject);
    sections.get(section).push({
      ...commit,
      summary: cleanSubject(commit.subject),
    });
  }

  return SECTION_ORDER
    .map((title) => ({
      title,
      description: SECTION_DESCRIPTIONS[title],
      entries: sections.get(title),
    }))
    .filter((section) => section.entries.length > 0);
}

export function formatMarkdown(sections, options = {}) {
  const title = options.title || 'Changelog';
  const range = getGitRange(options);
  const lines = [`# ${title}`, ''];

  if (range === 'HEAD') {
    lines.push('_Source: full repository history through `HEAD`._', '');
  } else {
    lines.push(`_Source: git range \`${range}\`._`, '');
  }

  if (sections.length === 0) {
    lines.push('No commits found for the requested range.', '');
    return lines.join('\n');
  }

  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    lines.push(section.description, '');
    for (const entry of section.entries) {
      lines.push(`- ${entry.summary} (${entry.shortHash}, ${entry.date})`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function generateChangelog(options = {}) {
  const commits = readGitCommits(options);
  const sections = buildSections(commits);
  const markdown = formatMarkdown(sections, options);

  return { commits, sections, markdown };
}

export function printHelp() {
  console.log(`Usage: node scripts/generate-changelog.mjs [options]

Options:
  --from <rev>     Start revision (exclusive)
  --to <rev>       End revision (inclusive, default: HEAD)
  --range <expr>   Explicit git revision range (for example main..HEAD)
  --limit <count>  Restrict the number of commits read
  --output, -o     Write markdown to a file instead of stdout
  --repo <path>    Run against a different git repository
  --title <text>   Override the markdown title
  --help, -h       Show this help message
`);
}

function runCli() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const { markdown } = generateChangelog(options);

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), markdown);
      console.error(`Wrote changelog to ${path.resolve(options.output)}`);
      return;
    }

    process.stdout.write(markdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCli();
}

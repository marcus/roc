#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TITLE = 'Changelog';

const SECTION_DESCRIPTIONS = {
  Features: 'Product and developer-facing improvements.',
  Fixes: 'Bug fixes and compatibility updates.',
  Documentation: 'Documentation and contributor guidance changes.',
  'Build & Tooling': 'Build, packaging, and automation work.',
  Icons: 'Icon additions, redesigns, and metadata updates.',
  'Other Changes': 'Changes that do not match a more specific section.',
};

const CONVENTIONAL_SECTIONS = new Map([
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Fixes'],
  ['docs', 'Documentation'],
  ['build', 'Build & Tooling'],
  ['chore', 'Build & Tooling'],
  ['ci', 'Build & Tooling'],
  ['test', 'Build & Tooling'],
  ['refactor', 'Build & Tooling'],
]);

const HELP_TEXT = `Usage: node scripts/generate-changelog.mjs [options]

Options:
  --from <rev>     Start revision (exclusive)
  --to <rev>       End revision (inclusive, default: HEAD)
  --range <expr>   Explicit git revision range (for example main..HEAD)
  --limit <count>  Restrict the number of commits read
  --repo <path>    Run against a different git repository
  --title <text>   Override the markdown title
  --output, -o     Write markdown to a file instead of stdout
  --help, -h       Show this help message
`;

export function parseArgs(argv) {
  const options = {
    from: '',
    to: 'HEAD',
    range: '',
    limit: 0,
    repo: process.cwd(),
    title: DEFAULT_TITLE,
    output: '',
    help: false,
  };
  let toProvided = false;

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
      toProvided = true;
      continue;
    }

    if (token === '--range') {
      options.range = expectValue(argv, ++index, token);
      continue;
    }

    if (token === '--limit') {
      const rawLimit = expectValue(argv, ++index, token);
      options.limit = Number.parseInt(rawLimit, 10);
      if (!Number.isInteger(options.limit) || options.limit < 1) {
        throw new Error(`Expected a positive integer for ${token}, received "${rawLimit}".`);
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

    if (token === '--output' || token === '-o') {
      options.output = expectValue(argv, ++index, token);
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (options.range && (options.from || toProvided)) {
    throw new Error('Use either --range or --from/--to, not both.');
  }

  return options;
}

function expectValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

export function getGitRange(options = {}) {
  if (options.range) {
    return options.range;
  }

  if (options.from) {
    return `${options.from}..${options.to || 'HEAD'}`;
  }

  return options.to || 'HEAD';
}

export function readGitCommits(options = {}) {
  const repo = path.resolve(options.repo || process.cwd());
  const gitArgs = [
    '-C',
    repo,
    'log',
    '--date=short',
    '--pretty=format:%H%x1f%h%x1f%s%x1f%ad',
  ];

  if (options.limit) {
    gitArgs.push(`--max-count=${options.limit}`);
  }

  gitArgs.push(getGitRange(options));

  const raw = execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  if (!raw) {
    return [];
  }

  return raw.split('\n').map((line) => {
    const [hash, shortHash, subject, date] = line.split('\x1f');
    return {
      hash,
      shortHash,
      subject: normalizeSubject(subject),
      date,
    };
  });
}

export function normalizeSubject(subject) {
  return String(subject || '').replace(/\s+/g, ' ').trim();
}

export function cleanSubject(subject) {
  return normalizeSubject(subject)
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .replace(/\s+(?:\((?:td|TD)-[^)]+\)|\[(?:td|TD)-[^\]]+\])$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyCommit(subject) {
  const normalized = normalizeSubject(subject);
  const conventional = normalized.match(/^([a-z]+)(?:\([^)]+\))?!?:\s+/i);
  if (conventional) {
    return CONVENTIONAL_SECTIONS.get(conventional[1].toLowerCase()) || 'Other Changes';
  }

  const lower = normalized.toLowerCase();

  if (/\b(fix|fixed|fixes|bug|bugs|compatibility|regression)\b/.test(lower)) {
    return 'Fixes';
  }

  if (/\b(readme|docs?|documentation|guide|guides)\b/.test(lower)) {
    return 'Documentation';
  }

  if (/\b(build|script|scripts|pipeline|codegen|types|type declarations|package|exports|automation|watch|lint|format)\b/.test(lower)) {
    return 'Build & Tooling';
  }

  if (/\b(icon|icons|logo|logos|brand|brands|sprite|metadata|category|categories|redesign)\b/.test(lower)) {
    return 'Icons';
  }

  if (/\b(add|adds|added|new|support|supports|introduce|introduces)\b/.test(lower)) {
    return 'Features';
  }

  return 'Other Changes';
}

export function buildSections(commits) {
  const sections = [];

  for (const commit of commits) {
    const title = classifyCommit(commit.subject);
    const entry = {
      ...commit,
      summary: cleanSubject(commit.subject),
    };
    const current = sections.at(-1);

    if (current && current.title === title) {
      current.entries.push(entry);
      continue;
    }

    sections.push({
      title,
      description: SECTION_DESCRIPTIONS[title],
      entries: [entry],
    });
  }

  return sections;
}

export function formatMarkdown(sections, options = {}) {
  const title = options.title || DEFAULT_TITLE;
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

  return `${lines.join('\n').trimEnd()}\n`;
}

export function generateChangelog(options = {}) {
  const commits = readGitCommits(options);
  const sections = buildSections(commits);
  const markdown = formatMarkdown(sections, options);

  return { commits, sections, markdown };
}

export function printHelp() {
  process.stdout.write(HELP_TEXT);
}

function writeOutput(outputPath, markdown) {
  const resolved = path.resolve(outputPath);
  fs.writeFileSync(resolved, markdown);
  process.stderr.write(`Wrote changelog to ${resolved}\n`);
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
      writeOutput(options.output, markdown);
      return;
    }

    process.stdout.write(markdown);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCli();
}

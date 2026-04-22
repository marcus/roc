#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  if (options.range && options.from) {
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

  if (/^(fix|perf)(\([^)]+\))?!?:\s/.test(lower) || /\b(fix|fixed|fixes|bug|compatibility)\b/.test(lower)) {
    return 'Fixes';
  }

  if (/^docs(\([^)]+\))?!?:\s/.test(lower) || /\b(readme|docs?|documentation|guide)\b/.test(lower)) {
    return 'Documentation';
  }

  if (/^(build|chore|ci|test|refactor)(\([^)]+\))?!?:\s/.test(lower)
    || /\b(build|script|pipeline|codegen|types|type declarations|package|exports|automation|watch)\b/.test(lower)) {
    return 'Build & Tooling';
  }

  if (/^(feat)(\([^)]+\))?!?:\s/.test(lower)) {
    return 'Features';
  }

  if (/\b(icon|icons|logo|logos|brand|brands|sprite|metadata|category|categories|redesign)\b/.test(lower)) {
    return 'Icons';
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
    const previousSection = sections[sections.length - 1];

    if (previousSection && previousSection.title === title) {
      previousSection.entries.push(entry);
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

#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTION_ORDER = [
  ['features', 'Features'],
  ['fixes', 'Fixes'],
  ['docs', 'Docs'],
  ['icons-assets', 'Icons & Assets'],
  ['maintenance', 'Maintenance'],
  ['other', 'Other'],
];
const CONVENTIONAL_SECTIONS = new Map([
  ['feat', 'features'],
  ['feature', 'features'],
  ['fix', 'fixes'],
  ['docs', 'docs'],
  ['doc', 'docs'],
  ['chore', 'maintenance'],
  ['build', 'maintenance'],
  ['ci', 'maintenance'],
  ['test', 'maintenance'],
  ['refactor', 'maintenance'],
  ['perf', 'maintenance'],
  ['style', 'maintenance'],
]);
const IGNORED_SUBJECTS = new Set([
  'formatting',
  'nothing to see here.',
  'nothing to see here',
]);
const ICON_KEYWORDS = [
  'icon',
  'icons',
  'logo',
  'logos',
  'sprite',
  'svg',
  'svgs',
  'brand',
  'brands',
  'map',
  'maps',
  'illustration',
  'illustrations',
  'demo',
];
const DOC_KEYWORDS = ['readme', 'docs', 'documentation', 'guide', 'claude.md'];
const FIX_KEYWORDS = [
  'fix',
  'bug',
  'compatibility',
  'regression',
  'installable',
  'resolve',
  'broken',
  'repair',
  'remove from tracking',
];
const FEATURE_KEYWORDS = [
  'typescript',
  'type declarations',
  'type resolution',
  'svelte',
  'react',
  'component',
  'components',
  'codegen',
  'responsive',
  'export conditions',
];
const MAINTENANCE_KEYWORDS = [
  'package',
  'exports',
  'types',
  'type declarations',
  'typescript',
  '.gitignore',
  'build script',
  'build pipeline',
  'codegen',
  'scaffold',
  'watch debounce',
];

function parseArgs(argv) {
  const options = {
    from: null,
    to: null,
    write: null,
    title: 'Changelog',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--from' || arg === '--to' || arg === '--write' || arg === '--title') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runGit(args, cwd = ROOT) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function buildRevisionArgs({ from, to }) {
  if (from && to) {
    return [`${from}..${to}`];
  }
  if (from) {
    return [`${from}..HEAD`];
  }
  if (to) {
    return [to];
  }
  return ['HEAD'];
}

export function collectCommits({ cwd = ROOT, from = null, to = null } = {}) {
  const format = '%H%x1f%h%x1f%ad%x1f%s%x1f%b%x1e';
  const output = runGit(
    ['log', '--date=short', `--pretty=format:${format}`, ...buildRevisionArgs({ from, to })],
    cwd,
  );

  return output
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, shortHash, date, subject, body = ''] = entry.split('\x1f');
      return {
        hash,
        shortHash,
        date,
        subject: subject.trim(),
        body: body.trim(),
      };
    });
}

function findConventionalType(subject) {
  const match = /^(?<type>[a-z]+)(?:\([^)]+\))?!?:\s+(?<rest>.+)$/i.exec(subject);
  if (!match) {
    return { type: null, title: subject.trim() };
  }

  const type = match.groups.type.toLowerCase();
  const title = match.groups.rest.trim();
  return { type, title };
}

function normalizeTitle(title) {
  if (!title) {
    return title;
  }

  return /^[a-z]/.test(title) ? `${title[0].toUpperCase()}${title.slice(1)}` : title;
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isNoiseCommit(subject, body) {
  const normalized = subject.trim().toLowerCase();
  if (IGNORED_SUBJECTS.has(normalized)) {
    return true;
  }

  const combined = `${normalized}\n${body.toLowerCase()}`;
  if (normalized === 'formatting' || normalized.startsWith('formatting ')) {
    return true;
  }

  return combined.includes('format only') || combined.includes('formatting only');
}

export function classifyCommit(commit) {
  const parsed = findConventionalType(commit.subject);
  const title = normalizeTitle(parsed.title);
  const { type } = parsed;
  const combined = `${title}\n${commit.body}`.toLowerCase();

  if (isNoiseCommit(commit.subject, commit.body)) {
    return { section: 'maintenance', title, hidden: true };
  }

  if (type && CONVENTIONAL_SECTIONS.has(type)) {
    return { section: CONVENTIONAL_SECTIONS.get(type), title, hidden: false };
  }

  if (includesAny(combined, DOC_KEYWORDS)) {
    return { section: 'docs', title, hidden: false };
  }

  if (includesAny(combined, FIX_KEYWORDS)) {
    return { section: 'fixes', title, hidden: false };
  }

  if (includesAny(combined, FEATURE_KEYWORDS)) {
    return { section: 'features', title, hidden: false };
  }

  if (combined === 'food' || combined.startsWith('food\n')) {
    return { section: 'icons-assets', title, hidden: false };
  }

  if (includesAny(combined, ICON_KEYWORDS)) {
    return { section: 'icons-assets', title, hidden: false };
  }

  if (includesAny(combined, MAINTENANCE_KEYWORDS)) {
    return { section: 'maintenance', title, hidden: false };
  }

  if (combined === 'spec' || combined.startsWith('spec\n')) {
    return { section: 'maintenance', title, hidden: false };
  }

  if (/^(add|ship|make|emit|extract|generate|implement|support)\b/i.test(title)) {
    return { section: 'features', title, hidden: false };
  }

  return { section: 'other', title, hidden: false };
}

function makeRangeLabel({ from, to, commits }) {
  if (!commits.length) {
    if (from && to) return `${from}..${to}`;
    if (from) return `${from}..HEAD`;
    if (to) return `repo start..${to}`;
    return 'repository history';
  }

  const oldest = commits.at(-1).date;
  const newest = commits[0].date;
  const revision = from && to ? `${from}..${to}` : from ? `${from}..HEAD` : to ? `repo start..${to}` : 'repo start..HEAD';
  return `${revision} (${oldest} to ${newest})`;
}

export function synthesizeCommits(commits) {
  const grouped = new Map(SECTION_ORDER.map(([key]) => [key, []]));
  const ignored = [];

  for (const commit of commits) {
    const classification = classifyCommit(commit);
    const entry = {
      ...commit,
      title: classification.title,
      section: classification.section,
    };

    if (classification.hidden) {
      ignored.push(entry);
      continue;
    }

    grouped.get(classification.section).push(entry);
  }

  return { grouped, ignored };
}

export function renderMarkdown({ title = 'Changelog', from = null, to = null, commits }) {
  const { grouped, ignored } = synthesizeCommits(commits);
  const lines = [`# ${title}`, ''];
  lines.push(`_Range: ${makeRangeLabel({ from, to, commits })}_`);
  lines.push(`_Included ${commits.length - ignored.length} commits; ignored ${ignored.length} noisy commit${ignored.length === 1 ? '' : 's'}._`);
  lines.push('');

  let sectionCount = 0;
  for (const [key, label] of SECTION_ORDER) {
    const entries = grouped.get(key);
    if (!entries.length) {
      continue;
    }

    sectionCount += 1;
    lines.push(`## ${label}`);
    lines.push('');
    for (const entry of entries) {
      lines.push(`- ${entry.title} (\`${entry.shortHash}\`, ${entry.date})`);
    }
    lines.push('');
  }

  if (sectionCount === 0) {
    lines.push('No changelog-worthy commits found for the requested range.');
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function generateChangelog(options = {}) {
  const commits = collectCommits(options);
  return renderMarkdown({ ...options, commits });
}

export function printHelp() {
  process.stdout.write(`Usage: npm run changelog -- [--from <rev>] [--to <rev>] [--write <path>] [--title <text>]

Generate a deterministic Markdown changelog from git history.

Options:
  --from <rev>   Start revision (exclusive, git range semantics)
  --to <rev>     End revision (inclusive target; defaults to HEAD)
  --write <path> Write Markdown to a file instead of stdout
  --title <text> Override the Markdown heading
  --help         Show this help message
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const markdown = generateChangelog(options);

  if (options.write) {
    const destination = path.resolve(process.cwd(), options.write);
    fs.writeFileSync(destination, markdown);
    process.stdout.write(`Wrote changelog to ${destination}\n`);
    return;
  }

  process.stdout.write(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

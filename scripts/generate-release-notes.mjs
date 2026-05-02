#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSections,
  getGitRange,
  parseArgs,
  readGitCommits,
} from './generate-changelog.mjs';

export function parseReleaseNotesArgs(argv) {
  const options = parseArgs(argv);
  const hasTitle = argv.includes('--title');

  if (!hasTitle) {
    options.title = 'Release Notes';
  }

  return options;
}

export function formatReleaseNotesMarkdown(sections, options = {}) {
  const title = options.title || 'Release Notes';
  const range = getGitRange(options);
  const lines = [`# ${title}`, ''];

  if (range === 'HEAD') {
    lines.push('_Source: full repository history through `HEAD`._', '');
  } else {
    lines.push(`_Source: git range \`${range}\`._`, '');
  }

  lines.push('## Assumptions', '');
  lines.push('- Drafted from local git commit subjects only.');
  lines.push('- Commit subjects are cleaned and grouped with the changelog synthesizer heuristics.');
  lines.push('- Review before publishing if release scope, issue links, or user-facing wording need adjustment.');
  lines.push('');

  if (sections.length === 0) {
    lines.push('No commits found for the requested range.', '');
    return lines.join('\n');
  }

  lines.push('## Highlights', '');

  for (const section of sections) {
    lines.push(`### ${section.title}`, '');
    for (const entry of section.entries) {
      lines.push(`- ${entry.summary}`);
    }
    lines.push('');
  }

  lines.push('## Source Commits', '');

  for (const section of sections) {
    for (const entry of section.entries) {
      lines.push(`- ${entry.shortHash} ${entry.date} ${entry.summary}`);
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function generateReleaseNotes(options = {}) {
  const commits = readGitCommits(options);
  const sections = buildSections(commits);
  const markdown = formatReleaseNotesMarkdown(sections, options);

  return { commits, sections, markdown };
}

export function printHelp() {
  console.log(`Usage: node scripts/generate-release-notes.mjs [options]

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
    const options = parseReleaseNotesArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const { markdown } = generateReleaseNotes(options);

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), markdown);
      console.error(`Wrote release notes to ${path.resolve(options.output)}`);
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

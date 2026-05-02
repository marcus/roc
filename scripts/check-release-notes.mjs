#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  formatReleaseNotesMarkdown,
  generateReleaseNotes,
  parseReleaseNotesArgs,
} from './generate-release-notes.mjs';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function testParseArgs() {
  const defaults = parseReleaseNotesArgs(['--from', 'v0.1.0', '--limit', '3']);
  assert.equal(defaults.from, 'v0.1.0');
  assert.equal(defaults.to, 'HEAD');
  assert.equal(defaults.limit, 3);
  assert.equal(defaults.title, 'Release Notes');

  const titled = parseReleaseNotesArgs(['--range', 'main..HEAD', '--title', 'Roc 0.2.0 Notes']);
  assert.equal(titled.range, 'main..HEAD');
  assert.equal(titled.title, 'Roc 0.2.0 Notes');
}

function testDeterministicMarkdown() {
  const sections = [
    {
      title: 'Features',
      entries: [
        {
          summary: 'add release notes drafter',
          shortHash: 'abc1234',
          date: '2026-05-02',
        },
      ],
    },
    {
      title: 'Documentation',
      entries: [
        {
          summary: 'document release workflow',
          shortHash: 'def5678',
          date: '2026-05-01',
        },
      ],
    },
  ];
  const markdown = formatReleaseNotesMarkdown(sections, {
    range: 'v0.1.0..HEAD',
    title: 'Roc 0.2.0 Notes',
  });

  assert.equal(markdown, `# Roc 0.2.0 Notes

_Source: git range \`v0.1.0..HEAD\`._

## Assumptions

- Drafted from local git commit subjects only.
- Commit subjects are cleaned and grouped with the changelog synthesizer heuristics.
- Review before publishing if release scope, issue links, or user-facing wording need adjustment.

## Highlights

### Features

- add release notes drafter

### Documentation

- document release workflow

## Source Commits

- abc1234 2026-05-02 add release notes drafter
- def5678 2026-05-01 document release workflow
`);
}

function testEmptyRangeMarkdown() {
  const markdown = formatReleaseNotesMarkdown([], { range: 'HEAD..HEAD' });

  assert.match(markdown, /^# Release Notes/m);
  assert.match(markdown, /_Source: git range `HEAD\.\.HEAD`\._/);
  assert.match(markdown, /## Assumptions/);
  assert.match(markdown, /No commits found for the requested range\./);
  assert.ok(!markdown.includes('## Highlights'));
}

function testTempGitRepoIntegration() {
  const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-release-notes-'));
  run('git', ['init', tempRepo]);
  run('git', ['-C', tempRepo, 'config', 'user.email', 'roc@example.test']);
  run('git', ['-C', tempRepo, 'config', 'user.name', 'Roc Test']);

  fs.writeFileSync(path.join(tempRepo, 'README.md'), 'one\n');
  run('git', ['-C', tempRepo, 'add', 'README.md']);
  run('git', ['-C', tempRepo, 'commit', '-m', 'docs: add readme'], {
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-05-01T12:00:00Z',
      GIT_COMMITTER_DATE: '2026-05-01T12:00:00Z',
    },
  });
  const base = run('git', ['-C', tempRepo, 'rev-parse', 'HEAD']).trim();

  fs.writeFileSync(path.join(tempRepo, 'feature.txt'), 'two\n');
  run('git', ['-C', tempRepo, 'add', 'feature.txt']);
  run('git', ['-C', tempRepo, 'commit', '-m', 'feat: add release note export'], {
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-05-02T12:00:00Z',
      GIT_COMMITTER_DATE: '2026-05-02T12:00:00Z',
    },
  });

  const result = generateReleaseNotes({
    repo: tempRepo,
    from: base,
    to: 'HEAD',
    title: 'Temp Release Notes',
  });

  assert.equal(result.commits.length, 1);
  assert.deepEqual(
    result.sections.map((section) => section.title),
    ['Features'],
  );
  assert.match(result.markdown, /^# Temp Release Notes/m);
  assert.match(result.markdown, /_Source: git range `[a-f0-9]{40}\.\.HEAD`\._/);
  assert.match(result.markdown, /### Features/);
  assert.match(result.markdown, /- add release note export/);
  assert.match(result.markdown, /## Source Commits/);
}

function testCliOutput() {
  const repo = path.resolve(import.meta.dirname, '..');
  const output = path.join(os.tmpdir(), `roc-release-notes-${process.pid}.md`);

  try {
    run('node', [
      path.join(repo, 'scripts/generate-release-notes.mjs'),
      '--repo',
      repo,
      '--limit',
      '1',
      '--output',
      output,
    ]);

    const markdown = fs.readFileSync(output, 'utf8');
    assert.match(markdown, /^# Release Notes/m);
    assert.match(markdown, /## Assumptions/);
  } finally {
    fs.rmSync(output, { force: true });
  }
}

function main() {
  testParseArgs();
  testDeterministicMarkdown();
  testEmptyRangeMarkdown();
  testTempGitRepoIntegration();
  testCliOutput();

  console.log('check-release-notes: ok');
}

main();

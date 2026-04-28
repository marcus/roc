#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildSections,
  classifyCommit,
  cleanSubject,
  formatMarkdown,
  generateChangelog,
  parseArgs,
} from './generate-changelog.mjs';

function testParseArgs() {
  const parsed = parseArgs([
    '--from',
    'v0.1.0',
    '--to',
    'HEAD~1',
    '--limit',
    '5',
    '--repo',
    '.',
    '--title',
    'Release Notes',
    '--output',
    'CHANGELOG.md',
  ]);

  assert.equal(parsed.from, 'v0.1.0');
  assert.equal(parsed.to, 'HEAD~1');
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.repo, process.cwd());
  assert.equal(parsed.title, 'Release Notes');
  assert.equal(parsed.output, 'CHANGELOG.md');
}

function testInvalidArgs() {
  assert.throws(
    () => parseArgs(['--range', 'main..HEAD', '--from', 'main']),
    /Use either --range or --from\/--to/,
  );
  assert.throws(
    () => parseArgs(['--range', 'main..HEAD', '--to', 'HEAD~1']),
    /Use either --range or --from\/--to/,
  );
  assert.throws(() => parseArgs(['--limit', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--repo']), /Missing value/);
}

function testSubjectCleanup() {
  assert.equal(cleanSubject('feat:   add README workflow   (td-6cf1f0)'), 'add README workflow');
  assert.equal(cleanSubject('fix(parser)!: repair   date output [TD-abc123]'), 'repair date output');
  assert.equal(cleanSubject('  Add   icon metadata  '), 'Add icon metadata');
}

function testClassificationPrecedence() {
  assert.equal(classifyCommit('feat: add README scripts package exports'), 'Features');
  assert.equal(classifyCommit('feat(icons)!: add build docs for sprites'), 'Features');
  assert.equal(classifyCommit('fix: update docs package exports'), 'Fixes');
  assert.equal(classifyCommit('perf: improve README generation'), 'Fixes');
  assert.equal(classifyCommit('docs: mention build scripts'), 'Documentation');
  assert.equal(classifyCommit('build: ship new feature docs'), 'Build & Tooling');
  assert.equal(classifyCommit('chore: add package export docs'), 'Build & Tooling');
  assert.equal(classifyCommit('Add 12 new icon variants'), 'Icons');
  assert.equal(classifyCommit('Tidy up release prep'), 'Other Changes');
}

function testSectionOrderPreservation() {
  const sections = buildSections([
    { hash: '1', shortHash: '1111111', subject: 'feat: add changelog generator', date: '2026-04-19' },
    { hash: '2', shortHash: '2222222', subject: 'docs: refresh README', date: '2026-04-18' },
    { hash: '3', shortHash: '3333333', subject: 'feat: add release summary', date: '2026-04-17' },
    { hash: '4', shortHash: '4444444', subject: 'feat: add output flag', date: '2026-04-16' },
  ]);

  assert.deepEqual(
    sections.map((section) => section.title),
    ['Features', 'Documentation', 'Features'],
  );
  assert.deepEqual(
    sections.map((section) => section.entries.length),
    [1, 1, 2],
  );
}

function testMarkdownFormatting() {
  const sections = buildSections([
    { hash: '1', shortHash: '1111111', subject: 'feat: add changelog generator', date: '2026-04-19' },
    { hash: '2', shortHash: '2222222', subject: 'docs: refresh README', date: '2026-04-18' },
  ]);
  const markdown = formatMarkdown(sections, { range: 'main..HEAD', title: 'Release Notes' });

  assert.match(markdown, /^# Release Notes/m);
  assert.match(markdown, /_Source: git range `main\.\.HEAD`\._/);
  assert.match(markdown, /## Features/);
  assert.match(markdown, /- add changelog generator \(1111111, 2026-04-19\)/);
  assert.match(markdown, /## Documentation/);
  assert.ok(!markdown.includes('## Fixes'));
  assert.ok(markdown.endsWith('\n'));
}

function testEmptyMarkdown() {
  const markdown = formatMarkdown([], { range: 'HEAD..HEAD' });

  assert.match(markdown, /No commits found for the requested range\./);
  assert.ok(!markdown.includes('## Features'));
}

function testOutputShapeSmoke() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-changelog-synth-'));
  assert.ok(fs.existsSync(tmp));
  fs.rmSync(tmp, { recursive: true, force: true });
}

function testLiveHistorySmoke() {
  const repo = path.resolve(import.meta.dirname, '..');
  const result = generateChangelog({ repo, limit: 12, title: 'Smoke Test Changelog' });

  assert.ok(result.commits.length > 0, 'expected at least one commit in live history');
  assert.ok(result.sections.length > 0, 'expected at least one rendered section');
  assert.match(result.markdown, /^# Smoke Test Changelog/m);
  assert.ok(
    result.markdown.includes('_Source: full repository history through `HEAD`._'),
    'expected full-history source note',
  );
  assert.ok(
    result.sections.every((section) => section.entries.length > 0),
    'expected sections to omit empty groups',
  );
}

function main() {
  testParseArgs();
  testInvalidArgs();
  testSubjectCleanup();
  testClassificationPrecedence();
  testSectionOrderPreservation();
  testMarkdownFormatting();
  testEmptyMarkdown();
  testOutputShapeSmoke();
  testLiveHistorySmoke();

  console.log('check-changelog-synth: ok');
}

main();

#!/usr/bin/env node
import assert from 'node:assert/strict';
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
  const parsed = parseArgs(['--from', 'abc123', '--to', 'HEAD~2', '--limit', '5', '--title', 'Release Notes']);
  assert.equal(parsed.from, 'abc123');
  assert.equal(parsed.to, 'HEAD~2');
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.title, 'Release Notes');
}

function testClassificationHeuristics() {
  assert.equal(classifyCommit('feat: add changelog generator'), 'Features');
  assert.equal(classifyCommit('fix: repair export map'), 'Fixes');
  assert.equal(classifyCommit('docs: refresh README'), 'Documentation');
  assert.equal(classifyCommit('build: add package verification step'), 'Build & Tooling');
  assert.equal(classifyCommit('Add 12 new icon variants'), 'Icons');
  assert.equal(classifyCommit('Tidy up release prep'), 'Other Changes');
}

function testSectionFormatting() {
  const sections = buildSections([
    { hash: '1', shortHash: '1111111', subject: 'feat: add changelog generator', date: '2026-04-19' },
    { hash: '2', shortHash: '2222222', subject: 'docs: refresh README', date: '2026-04-18' },
    { hash: '3', shortHash: '3333333', subject: 'Add 12 new icon variants', date: '2026-04-17' },
  ]);

  assert.deepEqual(
    sections.map((section) => section.title),
    ['Features', 'Documentation', 'Icons'],
  );
  assert.equal(cleanSubject('feat: add changelog generator (td-123abc)'), 'add changelog generator');

  const markdown = formatMarkdown(sections, { range: 'main..HEAD', title: 'Release Notes' });
  assert.match(markdown, /^# Release Notes/m);
  assert.match(markdown, /_Source: git range `main\.\.HEAD`\._/);
  assert.match(markdown, /## Features/);
  assert.match(markdown, /- add changelog generator \(1111111, 2026-04-19\)/);
  assert.ok(!markdown.includes('## Fixes'));
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
  const tempRepoPath = path.join(os.tmpdir(), 'roc-check-changelog-synth');
  assert.ok(tempRepoPath.length > 0);

  testParseArgs();
  testClassificationHeuristics();
  testSectionFormatting();
  testLiveHistorySmoke();

  console.log('check-changelog-synth: ok');
}

main();

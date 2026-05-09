#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
  checkCommitMessage,
  checkCommitSubject,
  cleanCommitSubjectSummary,
  normalizeCommitMessage,
  normalizeCommitSubject,
  parseConventionalSubject,
} from './normalize-commit-message.mjs';

function testRawHistoryExamples() {
  assert.equal(normalizeCommitSubject('More icons.'), 'feat(icons): more icons');
  assert.equal(
    normalizeCommitSubject('Add MessageSquarePlus icon'),
    'feat(icons): add MessageSquarePlus icon',
  );
}

function testExistingConventionalMessages() {
  assert.equal(normalizeCommitSubject('feat: Add changelog generator.'), 'feat: add changelog generator');
  assert.equal(normalizeCommitSubject('fix: repair export map'), 'fix: repair export map');
  assert.equal(normalizeCommitSubject('DOC: Refresh README.'), 'docs: refresh README');
}

function testScopedAndBreakingSubjects() {
  assert.equal(normalizeCommitSubject('FEAT(Icons): Add logo sprite.'), 'feat(icons): add logo sprite');
  assert.equal(normalizeCommitSubject('Fix(API)!: Remove old export.'), 'fix(api)!: remove old export');

  assert.deepEqual(parseConventionalSubject('fix(api)!: remove old export'), {
    type: 'fix',
    scope: 'api',
    breaking: true,
    summary: 'remove old export',
  });
}

function testCommonInferenceRules() {
  assert.equal(normalizeCommitSubject('Repair package exports.'), 'fix: repair package exports');
  assert.equal(normalizeCommitSubject('Document sprite usage.'), 'docs: document sprite usage');
  assert.equal(normalizeCommitSubject('Build Svelte declarations.'), 'build: build Svelte declarations');
  assert.equal(normalizeCommitSubject('Verify generated types.'), 'test: verify generated types');
  assert.equal(normalizeCommitSubject('Refactor SVG renderer.'), 'refactor: refactor SVG renderer');
  assert.equal(normalizeCommitSubject('Tidy release notes.'), 'chore: tidy release notes');
}

function testTaskSuffixesAndCleanSummaries() {
  assert.equal(
    normalizeCommitSubject('Add MessageSquarePlus icon (td-A1B2C3).'),
    'feat(icons): add MessageSquarePlus icon (td-a1b2c3)',
  );
  assert.equal(
    normalizeCommitSubject('Fix parser output [TD-abc123]'),
    'fix: fix parser output (td-abc123)',
  );
  assert.equal(cleanCommitSubjectSummary('feat(icons): add MessageSquarePlus icon (td-a1b2c3)'), 'add MessageSquarePlus icon');
}

function testMultilineMessagesPreserveBodyAndTrailers() {
  const input = [
    'Add MessageSquarePlus icon.',
    '',
    'Preserve this body exactly.',
    '',
    'Nightshift-Task: commit-normalize',
    'Nightshift-Ref: https://github.com/marcus/nightshift',
    '',
  ].join('\n');

  const expected = [
    'feat(icons): add MessageSquarePlus icon',
    '',
    'Preserve this body exactly.',
    '',
    'Nightshift-Task: commit-normalize',
    'Nightshift-Ref: https://github.com/marcus/nightshift',
    '',
  ].join('\n');

  assert.equal(normalizeCommitMessage(input), expected);
  assert.deepEqual(checkCommitMessage(expected), {
    ok: true,
    normalized: expected,
    changed: false,
  });
}

function testCheckModeHelpers() {
  assert.deepEqual(checkCommitSubject('feat(icons): add MessageSquarePlus icon'), {
    ok: true,
    normalized: 'feat(icons): add MessageSquarePlus icon',
    changed: false,
  });
  assert.deepEqual(checkCommitSubject('Add MessageSquarePlus icon.'), {
    ok: false,
    normalized: 'feat(icons): add MessageSquarePlus icon',
    changed: true,
  });
}

function testUnknownConventionalTypesUseKnownTypes() {
  assert.equal(parseConventionalSubject('wip: add icon'), null);
  assert.equal(normalizeCommitSubject('wip: add icon'), 'feat(icons): add icon');
  assert.deepEqual(checkCommitSubject('wip: add icon'), {
    ok: false,
    normalized: 'feat(icons): add icon',
    changed: true,
  });
}

function testCliCheckSubjectArgumentsPreserveWhitespace() {
  const result = spawnSync(
    process.execPath,
    ['scripts/normalize-commit-message.mjs', '--check', 'feat:  add icon'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit subject is not normalized\./);
  assert.match(result.stderr, /Expected: feat: add icon/);
}

function testCliCheckRejectsUnknownConventionalTypes() {
  const result = spawnSync(
    process.execPath,
    ['scripts/normalize-commit-message.mjs', '--check', 'wip: add icon'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit subject is not normalized\./);
  assert.match(result.stderr, /Expected: feat\(icons\): add icon/);
}

function main() {
  testRawHistoryExamples();
  testExistingConventionalMessages();
  testScopedAndBreakingSubjects();
  testCommonInferenceRules();
  testTaskSuffixesAndCleanSummaries();
  testMultilineMessagesPreserveBodyAndTrailers();
  testCheckModeHelpers();
  testUnknownConventionalTypesUseKnownTypes();
  testCliCheckSubjectArgumentsPreserveWhitespace();
  testCliCheckRejectsUnknownConventionalTypes();

  console.log('check-commit-message-normalizer: ok');
}

main();

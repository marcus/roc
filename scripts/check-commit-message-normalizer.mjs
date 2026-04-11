#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI_PATH = path.join(ROOT, 'scripts', 'normalize-commit-message.mjs');
const HOOK_PATH = path.join(ROOT, '.githooks', 'commit-msg');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-commit-message-'));

const cliCases = [
  {
    name: 'keeps an already-normalized commit subject',
    input: 'feat: add roc icon\n',
    expectedStatus: 0,
    expectedMessage: 'feat: add roc icon\n',
  },
  {
    name: 'normalizes spacing, casing, punctuation, and task suffixes',
    input: ' Fix : Add explicit exports for svelte barrel imports.   (td-0FF12F) \n\nBody stays.\n',
    expectedStatus: 0,
    expectedMessage: 'fix: add explicit exports for svelte barrel imports (td-0ff12f)\n\nBody stays.\n',
  },
  {
    name: 'preserves trailers while normalizing a docs subject',
    input: ' DOCS : Backfill package documentation. \n\nNightshift-Task: commit-normalize\nNightshift-Ref: https://github.com/marcus/nightshift\n',
    expectedStatus: 0,
    expectedMessage: 'docs: backfill package documentation\n\nNightshift-Task: commit-normalize\nNightshift-Ref: https://github.com/marcus/nightshift\n',
  },
  {
    name: 'exempts revert commits',
    input: 'Revert "feat: add roc icon"\n\nThis reverts commit 7fa6f96.\n',
    expectedStatus: 0,
    expectedMessage: 'Revert "feat: add roc icon"\n\nThis reverts commit 7fa6f96.\n',
  },
  {
    name: 'exempts fixup commits',
    input: 'fixup! feat: add roc icon\n',
    expectedStatus: 0,
    expectedMessage: 'fixup! feat: add roc icon\n',
  },
  {
    name: 'rejects freeform feature subjects with a suggestion',
    input: 'Add MessageSquarePlus icon\n',
    expectedStatus: 1,
    expectedMessage: 'Add MessageSquarePlus icon\n',
    stderrIncludes: 'Suggested subject: feat: add MessageSquarePlus icon',
  },
  {
    name: 'rejects unsupported commit types',
    input: 'misc: adjust package exports\n',
    expectedStatus: 1,
    expectedMessage: 'misc: adjust package exports\n',
    stderrIncludes: 'Unsupported commit type "misc"',
  },
  {
    name: 'rejects freeform chore subjects with a suggestion',
    input: 'Formatting.\n',
    expectedStatus: 1,
    expectedMessage: 'Formatting.\n',
    stderrIncludes: 'Suggested subject: chore: formatting',
  },
];

const hookCases = [
  {
    name: 'hook rewrites a formatted subject in place',
    input: ' Docs : Backfill package documentation. \n',
    expectedStatus: 0,
    expectedMessage: 'docs: backfill package documentation\n',
  },
  {
    name: 'hook rejects a freeform subject',
    input: 'Add MessageSquarePlus icon\n',
    expectedStatus: 1,
    expectedMessage: 'Add MessageSquarePlus icon\n',
    stderrIncludes: 'Suggested subject: feat: add MessageSquarePlus icon',
  },
  {
    name: 'hook exempts merge commits',
    input: "Merge branch 'main' into feat/commit-message-normalizer-v2\n",
    expectedStatus: 0,
    expectedMessage: "Merge branch 'main' into feat/commit-message-normalizer-v2\n",
  },
];

let failures = 0;

console.log('1. Verifying CLI normalization cases...');
for (const [index, testCase] of cliCases.entries()) {
  const result = runCliCase(`cli-${index}`, testCase.input);
  failures += assertCaseResult(testCase, result);
}

console.log('2. Simulating the tracked commit-msg hook...');
fs.chmodSync(HOOK_PATH, 0o755);
for (const [index, testCase] of hookCases.entries()) {
  const result = runHookCase(`hook-${index}`, testCase.input);
  failures += assertCaseResult(testCase, result);
}

cleanup();

if (failures > 0) {
  console.error(`3. Commit message normalizer checks failed (${failures} case(s)).`);
  process.exit(1);
}

console.log(`3. Commit message normalizer checks passed (${cliCases.length + hookCases.length} cases).`);

function runCliCase(name, input) {
  const messagePath = writeTempMessage(name, input);
  const command = spawnSync(process.execPath, [CLI_PATH, messagePath], {
    encoding: 'utf8',
  });

  return {
    status: command.status ?? 1,
    stdout: command.stdout,
    stderr: command.stderr,
    message: fs.readFileSync(messagePath, 'utf8'),
  };
}

function runHookCase(name, input) {
  const messagePath = writeTempMessage(name, input);
  const command = spawnSync(HOOK_PATH, [messagePath], {
    encoding: 'utf8',
  });

  return {
    status: command.status ?? 1,
    stdout: command.stdout,
    stderr: command.stderr,
    message: fs.readFileSync(messagePath, 'utf8'),
  };
}

function writeTempMessage(name, input) {
  const messagePath = path.join(TMP_DIR, `${name}.txt`);
  fs.writeFileSync(messagePath, input);
  return messagePath;
}

function assertCaseResult(testCase, result) {
  const problems = [];

  if (result.status !== testCase.expectedStatus) {
    problems.push(`expected status ${testCase.expectedStatus}, received ${result.status}`);
  }

  if (result.message !== testCase.expectedMessage) {
    problems.push(`expected message ${JSON.stringify(testCase.expectedMessage)}, received ${JSON.stringify(result.message)}`);
  }

  if (testCase.stderrIncludes && !result.stderr.includes(testCase.stderrIncludes)) {
    problems.push(`expected stderr to include ${JSON.stringify(testCase.stderrIncludes)}, received ${JSON.stringify(result.stderr)}`);
  }

  if (problems.length > 0) {
    console.error(`   ✗ ${testCase.name}`);
    for (const problem of problems) {
      console.error(`     ${problem}`);
    }
    return 1;
  }

  console.log(`   ✓ ${testCase.name}`);
  return 0;
}

function cleanup() {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {}
}

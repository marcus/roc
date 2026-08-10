import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeMessage,
  normalizeMessageFile,
} from './normalize-commit-message.mjs';

test('leaves already normalized subjects untouched', () => {
  const message = 'Add commit message normalizer\n';

  assert.equal(normalizeMessage(message), message);
});

test('capitalizes lowercase subjects and removes trailing punctuation', () => {
  assert.equal(
    normalizeMessage('add commit message normalizer!\n'),
    'Add commit message normalizer\n',
  );
});

test('rewrites common conventional commit prefixes into sentence style', () => {
  assert.equal(
    normalizeMessage('feat(hooks): add commit message normalizer.\n'),
    'Add commit message normalizer\n',
  );
});

test('trims extra whitespace in the subject line', () => {
  assert.equal(
    normalizeMessage('  docs:   update   README   \n'),
    'Update README\n',
  );
});

test('preserves commit bodies and trailers', () => {
  const originalMessage = `fix: normalize   commit subject!\n
Keep the body exactly as written.

Nightshift-Task: commit-normalize
Nightshift-Ref: https://github.com/marcus/nightshift
`;

  const normalizedMessage = `Normalize commit subject\n
Keep the body exactly as written.

Nightshift-Task: commit-normalize
Nightshift-Ref: https://github.com/marcus/nightshift
`;

  assert.equal(normalizeMessage(originalMessage), normalizedMessage);
});

test('rewrites the first non-comment subject line in place', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'roc-commit-message-'));
  const filePath = path.join(tempDir, 'COMMIT_EDITMSG');
  const originalMessage = `# Please enter the commit message for your changes.\n
  chore:   tighten   subject spacing!  \n
Body stays put.
`;

  await writeFile(filePath, originalMessage, 'utf8');

  const changed = await normalizeMessageFile(filePath);
  const updatedMessage = await readFile(filePath, 'utf8');

  assert.equal(changed, true);
  assert.equal(
    updatedMessage,
    `# Please enter the commit message for your changes.\n
Tighten subject spacing\n
Body stays put.
`,
  );
});

test('skips merge commits', () => {
  const message = "Merge branch 'feature/icons' into main\n";

  assert.equal(normalizeMessage(message), message);
});

test('skips revert commits', () => {
  const message = 'Revert "Add commit message normalizer"\n';

  assert.equal(normalizeMessage(message), message);
});

test('skips fixup and squash commits', () => {
  const fixupMessage = 'fixup! add commit message normalizer\n';
  const squashMessage = 'squash! feat: add commit message normalizer\n';

  assert.equal(normalizeMessage(fixupMessage), fixupMessage);
  assert.equal(normalizeMessage(squashMessage), squashMessage);
});

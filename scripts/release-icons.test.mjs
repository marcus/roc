import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  STYLES,
  bumpVersion,
  defaultMetadata,
  parseArgs,
  validateIconSet,
  validateInventory,
} from './release-icons.mjs';

test('release defaults include publish-adjacent deploy and push', () => {
  assert.deepEqual(parseArgs([]), {
    bump: 'patch',
    check: false,
    dryRun: false,
    deploy: true,
    push: true,
    help: false,
  });
});

test('release options are parsed explicitly', () => {
  const options = parseArgs(['--check', '--bump', 'minor', '--category', 'Nature', '--no-deploy', '--no-push']);
  assert.equal(options.check, true);
  assert.equal(options.bump, 'minor');
  assert.equal(options.category, 'Nature');
  assert.equal(options.deploy, false);
  assert.equal(options.push, false);
  assert.throws(() => parseArgs(['--wat']), /Unknown option/);
});

test('versions bump from a three-part stable version', () => {
  assert.equal(bumpVersion('0.2.0', 'patch'), '0.2.1');
  assert.equal(bumpVersion('0.2.9', 'minor'), '0.3.0');
  assert.equal(bumpVersion('2.9.9', 'major'), '3.0.0');
});

test('metadata has useful filename-derived defaults', () => {
  assert.deepEqual(defaultMetadata('hummingbird-logo'), {
    label: 'Hummingbird Logo',
    description: 'Hummingbird Logo icon',
    category: 'Brand',
    tags: ['hummingbird', 'logo', 'brand', 'icon', 'symbol'],
  });
});

test('inventory validation catches style and metadata drift without enforcing legacy geometry', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-inventory-test-'));
  try {
    for (const style of STYLES) {
      fs.mkdirSync(path.join(root, style), { recursive: true });
      fs.writeFileSync(path.join(root, style, 'old-icon.svg'), '<svg/>');
    }
    const ontology = {
      categories: ['Objects'],
      icons: {
        'old-icon': { label: 'Old Icon', description: 'Legacy source', category: 'Objects', tags: [] },
      },
    };
    assert.deepEqual(validateInventory(ontology, root), []);
    fs.unlinkSync(path.join(root, 'solid', 'old-icon.svg'));
    assert.match(validateInventory(ontology, root).join('\n'), /solid\/old-icon\.svg is missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a complete four-style icon passes source validation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-release-test-'));
  const svgs = {
    outline: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    solid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 11h18v2H3Z" fill="currentColor"/></svg>',
    duotone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 10h18v4H3Z" fill="var(--color-duotone-fill)"/><path d="M3 12h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    sharp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="currentColor" stroke-width="1.5"/></svg>',
  };
  try {
    for (const style of STYLES) {
      fs.mkdirSync(path.join(root, style), { recursive: true });
      fs.writeFileSync(path.join(root, style, 'test-icon.svg'), svgs[style]);
    }
    assert.deepEqual(validateIconSet(['test-icon'], root), []);
    fs.unlinkSync(path.join(root, 'sharp', 'test-icon.svg'));
    assert.match(validateIconSet(['test-icon'], root).join('\n'), /missing style variant/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

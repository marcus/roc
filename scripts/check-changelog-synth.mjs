#!/usr/bin/env node
import assert from 'node:assert/strict';
import { classifyCommit, collectCommits, generateChangelog, renderMarkdown } from './generate-changelog.mjs';

const fixtureCommits = [
  {
    hash: '1111111111111111111111111111111111111111',
    shortHash: '1111111',
    date: '2026-03-19',
    subject: 'feat: add changelog generator',
    body: '',
  },
  {
    hash: '2222222222222222222222222222222222222222',
    shortHash: '2222222',
    date: '2026-03-18',
    subject: 'Add AI provider brand icons',
    body: 'Adds Anthropic and Gemini logos.',
  },
  {
    hash: '3333333333333333333333333333333333333333',
    shortHash: '3333333',
    date: '2026-03-17',
    subject: 'docs: update README',
    body: '',
  },
  {
    hash: '4444444444444444444444444444444444444444',
    shortHash: '4444444',
    date: '2026-03-16',
    subject: 'Fix SSR compatibility for Svelte exports',
    body: '',
  },
  {
    hash: '5555555555555555555555555555555555555555',
    shortHash: '5555555',
    date: '2026-03-15',
    subject: 'Formatting',
    body: '',
  },
];

const feature = classifyCommit(fixtureCommits[0]);
assert.equal(feature.section, 'features');
assert.equal(feature.hidden, false);

const icons = classifyCommit(fixtureCommits[1]);
assert.equal(icons.section, 'icons-assets');

const docs = classifyCommit(fixtureCommits[2]);
assert.equal(docs.section, 'docs');

const fix = classifyCommit(fixtureCommits[3]);
assert.equal(fix.section, 'fixes');

const ignored = classifyCommit(fixtureCommits[4]);
assert.equal(ignored.hidden, true);

const markdown = renderMarkdown({
  title: 'Fixture Changelog',
  from: 'abc1234',
  to: 'def5678',
  commits: fixtureCommits,
});

assert.ok(markdown.includes('# Fixture Changelog'));
assert.ok(markdown.includes('## Features'));
assert.ok(markdown.includes('## Fixes'));
assert.ok(markdown.includes('## Docs'));
assert.ok(markdown.includes('## Icons & Assets'));
assert.ok(markdown.includes('ignored 1 noisy commit'));
assert.ok(!markdown.includes('Formatting (`5555555`, 2026-03-15)'));

const repoCommits = collectCommits();
assert.ok(repoCommits.length > 0);

const repoMarkdown = generateChangelog({ title: 'Repo Changelog' });
assert.ok(repoMarkdown.includes('# Repo Changelog'));
assert.ok(repoMarkdown.includes('_Range: repo start..HEAD'));
assert.ok(repoMarkdown.includes('_Included '));
assert.match(repoMarkdown, /^## /m);

const explicitRangeFrom = repoCommits[3].hash;
const explicitRangeTo = repoCommits[1].hash;
const explicitRangeCommits = collectCommits({ from: explicitRangeFrom, to: explicitRangeTo });
assert.ok(explicitRangeCommits.length > 0);
assert.equal(explicitRangeCommits[0].hash, explicitRangeTo);
assert.ok(explicitRangeCommits.every((commit) => commit.hash !== explicitRangeFrom));

const explicitRangeMarkdown = generateChangelog({
  title: 'Explicit Range Changelog',
  from: explicitRangeFrom,
  to: explicitRangeTo,
});
assert.ok(explicitRangeMarkdown.includes(`# Explicit Range Changelog`));
assert.ok(explicitRangeMarkdown.includes(`${explicitRangeFrom}..${explicitRangeTo}`));
assert.ok(explicitRangeMarkdown.includes(explicitRangeCommits[0].shortHash));

process.stdout.write('Changelog synthesizer checks passed.\n');

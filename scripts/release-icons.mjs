#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const STYLES = ['outline', 'solid', 'duotone', 'sharp'];

const ROOT = path.resolve(import.meta.dirname, '..');
const SVG_ROOT = path.join(ROOT, 'src', 'svg');
const ONTOLOGY_PATH = path.join(ROOT, 'src', 'icons.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

const HELP = `Roc icon release

Put one SVG in each src/svg/{outline,solid,duotone,sharp}/ directory, then run:

  npm run release:icons

The command finds the changed icons, fills in missing metadata, validates all four
styles, rebuilds the package and demo, verifies the packed package, chooses the
next npm version, commits and tags the release, publishes it, deploys the public
preview, and pushes the commit and tag.

Options:
  --check                 Validate, build, and package-check without releasing
  --dry-run               Show the release plan without writing anything
  --bump <patch|minor|major>
                          Version bump relative to the newest local/npm version
                          (default: patch)
  --label <text>          Label for one new icon (default: filename in title case)
  --description <text>    Description for one new icon (default: "<Label> icon")
  --category <name>       Category for new icons (default: inferred, then Objects)
  --tags <a,b,c>          Search tags for one new icon (default: filename words)
  --message <text>        Source commit message
  --no-deploy             Do not deploy demo/index.html to the public preview
  --no-push               Do not push the release commit and tag
  -h, --help              Show this help

Examples:
  npm run release:icons -- --check
  npm run release:icons -- --dry-run
  npm run release:icons -- --category Nature --tags bird,flight,animal
  npm run release:icons -- --no-deploy --no-push

Authentication is read from NPM_TOKEN or an NPM_TOKEN entry in ~/.secrets.
The default command publishes to npm, deploys the preview, and pushes git.`;

export function parseArgs(argv) {
  const options = {
    bump: 'patch',
    check: false,
    dryRun: false,
    deploy: true,
    push: true,
    help: false,
  };
  const valueOptions = new Map([
    ['--bump', 'bump'],
    ['--label', 'label'],
    ['--description', 'description'],
    ['--category', 'category'],
    ['--tags', 'tags'],
    ['--message', 'message'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') options.check = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--no-deploy') options.deploy = false;
    else if (argument === '--no-push') options.push = false;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} needs a value`);
      options[valueOptions.get(argument)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}\n\nRun with --help to see every option.`);
    }
  }

  if (!['patch', 'minor', 'major'].includes(options.bump)) {
    throw new Error('--bump must be patch, minor, or major');
  }
  return options;
}

function run(command, args, { capture = false, env, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? `\n${(result.stderr || result.stdout || '').trim()}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${detail}`);
  }
  return capture ? (result.stdout || '').trim() : result.status;
}

function step(message) {
  console.log(`\n› ${message}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function titleCase(name) {
  return name.split('-').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export function inferCategory(name) {
  const matches = [
    [/(?:^|-)(?:logo)(?:-|$)/, 'Brand'],
    [/^(?:arrow|chevron|caret)|(?:^|-)(?:map|compass|navigation|route)(?:-|$)/, 'Navigation'],
    [/(?:^|-)(?:user|users|person|people|face)(?:-|$)/, 'People'],
    [/(?:^|-)(?:file|folder|document|clipboard|notebook)(?:-|$)/, 'Files'],
    [/(?:^|-)(?:mail|message|chat|phone|send|inbox)(?:-|$)/, 'Communication'],
    [/(?:^|-)(?:play|pause|music|video|camera|volume|film)(?:-|$)/, 'Media'],
    [/(?:^|-)(?:car|truck|bus|train|plane|ship|bicycle)(?:-|$)/, 'Transport'],
    [/(?:^|-)(?:cloud|sun|moon|rain|snow|wind|weather)(?:-|$)/, 'Weather'],
    [/(?:^|-)(?:cart|bag|card|wallet|coin|receipt)(?:-|$)/, 'Commerce'],
    [/(?:^|-)(?:code|git|terminal|database|server|cpu)(?:-|$)/, 'Development'],
  ];
  return matches.find(([pattern]) => pattern.test(name))?.[1] || 'Objects';
}

export function defaultMetadata(name, options = {}) {
  const label = options.label || titleCase(name);
  const category = options.category || inferCategory(name);
  const inferredTags = [...new Set([
    ...name.split('-').filter(Boolean),
    category.toLowerCase(),
    'icon',
    'symbol',
  ])].slice(0, 6);
  return {
    label,
    description: options.description || `${label} icon`,
    category,
    tags: options.tags
      ? [...new Set(options.tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
      : inferredTags,
  };
}

function appendMetadataEntries(source, entries) {
  if (entries.length === 0) return source;
  const marker = '\n  }\n}';
  const markerIndex = source.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error('src/icons.json does not have the expected top-level shape');
  const iconsBefore = source.slice(0, markerIndex);
  const separator = /"\s*$/.test(iconsBefore.trimEnd()) || /}\s*$/.test(iconsBefore.trimEnd()) ? ',' : '';
  const rendered = entries.map(([name, metadata]) => {
    const tags = metadata.tags.map((tag) => JSON.stringify(tag)).join(', ');
    return `    ${JSON.stringify(name)}: {\n` +
      `      "label": ${JSON.stringify(metadata.label)},\n` +
      `      "description": ${JSON.stringify(metadata.description)},\n` +
      `      "category": ${JSON.stringify(metadata.category)},\n` +
      `      "tags": [${tags}]\n` +
      '    }';
  }).join(',\n');
  return `${iconsBefore}${separator}\n${rendered}${marker}\n`;
}

function sourceNames(root = SVG_ROOT) {
  const byStyle = new Map();
  for (const style of STYLES) {
    const directory = path.join(root, style);
    const names = fs.existsSync(directory)
      ? fs.readdirSync(directory).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4))
      : [];
    byStyle.set(style, new Set(names));
  }
  return byStyle;
}

function changedPaths() {
  const tracked = run('git', ['diff', '--name-only', 'HEAD'], { capture: true });
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard'], { capture: true });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').map((item) => item.trim()).filter(Boolean))];
}

function changedIconNames(paths) {
  const pattern = /^src\/svg\/(?:outline|solid|duotone|sharp)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.svg$/;
  return [...new Set(paths.map((file) => file.match(pattern)?.[1]).filter(Boolean))].sort();
}

function graphicalElements(svg) {
  return [...svg.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)\/?\s*>/g)]
    .map((match) => ({ tag: match[1], attributes: match[2] }));
}

export function validateSvg(name, style, svg) {
  const errors = [];
  const opening = svg.match(/^\s*<svg\b([^>]*)>/)?.[1] || '';
  const elements = graphicalElements(svg);
  const add = (message) => errors.push(`${style}/${name}.svg: ${message}`);

  if (!opening) add('missing root <svg> element');
  if (!/\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(opening)) add('root must declare the SVG namespace');
  if (!/\bviewBox="0 0 24 24"/.test(opening)) add('root must use viewBox="0 0 24 24"');
  if (!/\bfill="none"/.test(opening)) add('root must use fill="none"');
  if (/\b(?:width|height)=/.test(opening)) add('root cannot set width or height');
  if (/<(?:title|desc|defs)\b|<!--/.test(svg)) add('metadata, defs, and comments are not allowed');
  if (/\d+\.\d{3,}/.test(svg)) add('coordinates may use at most two decimal places');
  if (elements.length === 0) add('contains no visible shape elements');

  for (const { tag, attributes } of elements) {
    for (const color of attributes.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)) {
      if (!['none', 'currentColor', 'var(--color-duotone-fill)'].includes(color[1])) {
        add(`${tag} uses unsupported color ${JSON.stringify(color[1])}`);
      }
    }
  }

  if (style === 'outline') {
    for (const { tag, attributes } of elements) {
      if (/\bfill=/.test(attributes)) add(`${tag} cannot set fill in outline style`);
      if (!/\bstroke="currentColor"/.test(attributes)) add(`${tag} must use stroke="currentColor"`);
      if (!/\bstroke-width="1\.5"/.test(attributes)) add(`${tag} must use stroke-width="1.5"`);
    }
  }
  if (style === 'solid') {
    for (const { tag, attributes } of elements) {
      const hasFill = /\bfill="currentColor"/.test(attributes);
      const allowedDetailStroke = /\bstroke="currentColor"/.test(attributes);
      if (!hasFill && !allowedDetailStroke) add(`${tag} must use fill="currentColor" (or a detail stroke)`);
    }
  }
  if (style === 'duotone') {
    if (!elements.some(({ attributes }) => /\bfill="var\(--color-duotone-fill\)"/.test(attributes))) {
      add('must include a var(--color-duotone-fill) background layer');
    }
    if (!elements.some(({ attributes }) => /\bstroke="currentColor"/.test(attributes))) {
      add('must include a currentColor foreground stroke');
    }
    if (!/\bfill="var\(--color-duotone-fill\)"/.test(elements[0]?.attributes || '')) {
      add('the first shape must be the duotone background layer');
    }
  }
  if (style === 'sharp') {
    if (/stroke-linecap="round"|\b(?:rx|ry)=/.test(svg)) add('sharp style cannot use round caps or rounded rectangles');
    for (const { tag, attributes } of elements) {
      if (!/\bstroke="currentColor"/.test(attributes)) add(`${tag} must use stroke="currentColor"`);
      if (!/\bstroke-width="1\.5"/.test(attributes)) add(`${tag} must use stroke-width="1.5"`);
    }
  }
  return errors;
}

export function validateIconSet(names, root = SVG_ROOT) {
  const errors = [];
  for (const name of names) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push(`${name}: filenames must use kebab-case`);
      continue;
    }
    for (const style of STYLES) {
      const file = path.join(root, style, `${name}.svg`);
      if (!fs.existsSync(file)) {
        errors.push(`${style}/${name}.svg: missing style variant`);
        continue;
      }
      errors.push(...validateSvg(name, style, fs.readFileSync(file, 'utf8')));
    }
  }
  return errors;
}

export function validateInventory(ontology, root = SVG_ROOT) {
  const errors = [];
  const byStyle = sourceNames(root);
  const names = [...new Set([...byStyle.values()].flatMap((set) => [...set]))].sort();
  const categories = new Set(ontology.categories || []);

  for (const name of names) {
    for (const style of STYLES) {
      if (!byStyle.get(style).has(name)) errors.push(`${style}/${name}.svg is missing`);
    }
    const metadata = ontology.icons?.[name];
    if (!metadata) {
      errors.push(`src/icons.json is missing metadata for ${name}`);
      continue;
    }
    if (!metadata.label || !metadata.description || !metadata.category || !Array.isArray(metadata.tags)) {
      errors.push(`src/icons.json has incomplete metadata for ${name}`);
    } else if (!categories.has(metadata.category)) {
      errors.push(`src/icons.json gives ${name} the unknown category ${metadata.category}`);
    }
  }
  for (const name of Object.keys(ontology.icons || {})) {
    if (!names.includes(name)) errors.push(`src/icons.json has metadata for missing icon ${name}`);
  }
  return errors;
}

export function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function bumpVersion(version, bump) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Unsupported version: ${version}`);
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function publishedVersions(packageName) {
  const result = spawnSync('npm', ['view', packageName, 'versions', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    if (/E404|404 Not Found/.test(result.stderr || '')) return [];
    throw new Error(`Could not read published npm versions:\n${(result.stderr || '').trim()}`);
  }
  const parsed = JSON.parse(result.stdout || '[]');
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((version) => /^\d+\.\d+\.\d+$/.test(version));
}

function publishedPackageInventory(packageName, version) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-published-'));
  try {
    const filename = run('npm', [
      'pack', `${packageName}@${version}`, '--pack-destination', directory, '--silent',
    ], { capture: true }).split('\n').at(-1);
    const tarball = path.join(directory, filename);
    const metadata = JSON.parse(run('tar', ['-xOf', tarball, 'package/dist/metadata.json'], { capture: true }));
    const publishedPackage = JSON.parse(run('tar', ['-xOf', tarball, 'package/package.json'], { capture: true }));
    return { metadata, packageJson: publishedPackage };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertPublishedBaseline(packageJson, newestPublished, localNames) {
  if (compareVersions(newestPublished, packageJson.version) <= 0) return;
  const published = publishedPackageInventory(packageJson.name, newestPublished);
  const local = new Set(localNames);
  const missing = published.metadata.icons.map((icon) => icon.name).filter((name) => !local.has(name));
  if (missing.length > 0) {
    throw new Error(
      `npm ${newestPublished} contains icon source missing from this checkout: ${missing.join(', ')}.\n` +
      'Sync those icons into src/svg and src/icons.json before creating a newer release.',
    );
  }
  if (JSON.stringify(published.packageJson.exports) !== JSON.stringify(packageJson.exports)) {
    throw new Error(
      `npm ${newestPublished} has a different exports map from this checkout. ` +
      'Sync package.json before creating a newer release.',
    );
  }
}

function readNpmToken() {
  if (process.env.NPM_TOKEN) return process.env.NPM_TOKEN;
  const secretsPath = path.join(os.homedir(), '.secrets');
  if (!fs.existsSync(secretsPath)) return null;
  const line = fs.readFileSync(secretsPath, 'utf8').split(/\r?\n/)
    .find((candidate) => /^\s*(?:export\s+)?NPM_TOKEN\s*=/.test(candidate));
  if (!line) return null;
  let value = line.replace(/^\s*(?:export\s+)?NPM_TOKEN\s*=\s*/, '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value || null;
}

function withNpmAuth(token, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-npm-'));
  const npmrc = path.join(directory, '.npmrc');
  fs.writeFileSync(npmrc, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 });
  try {
    return callback({ NPM_CONFIG_USERCONFIG: npmrc });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function verifyGeneratedPackage(expectedIconCount) {
  const metadata = readJson(path.join(ROOT, 'dist', 'metadata.json'));
  if (metadata.icons.length !== expectedIconCount || metadata.totalCount !== expectedIconCount * STYLES.length) {
    throw new Error(`Generated metadata has ${metadata.icons.length} icons/${metadata.totalCount} variants; expected ${expectedIconCount}/${expectedIconCount * STYLES.length}`);
  }
  const demo = fs.readFileSync(path.join(ROOT, 'demo', 'index.html'), 'utf8');
  if (!demo.includes(`${expectedIconCount} icons`)) {
    throw new Error('demo/index.html does not contain the current icon count');
  }
}

function gitHasUnpushedCommits() {
  const result = spawnSync('git', ['rev-list', '--count', '@{upstream}..HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 && Number(result.stdout.trim()) > 0;
}

function formatNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function assertReleaseScope(paths) {
  const allowed = paths.filter((file) =>
    file.startsWith('src/svg/') || file === 'src/icons.json' || file === 'demo/index.html');
  const unrelated = paths.filter((file) => !allowed.includes(file));
  if (unrelated.length > 0) {
    throw new Error(`Release stopped because the worktree also contains unrelated changes:\n  ${unrelated.join('\n  ')}\nCommit or stash them, then rerun the release.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  const packageJson = readJson(PACKAGE_PATH);
  const pathsBeforeBuild = changedPaths();
  const iconNames = changedIconNames(pathsBeforeBuild);
  const ontology = readJson(ONTOLOGY_PATH);
  const allSources = sourceNames();
  const completeNames = [...new Set([...allSources.values()].flatMap((set) => [...set]))].sort();
  const missingMetadata = completeNames.filter((name) => !ontology.icons?.[name]);
  const releaseNames = [...new Set([...iconNames, ...missingMetadata])].sort();

  if (missingMetadata.length > 1 && (options.label || options.description || options.tags)) {
    throw new Error('--label, --description, and --tags can only be used when one icon needs metadata');
  }

  const errors = validateIconSet(releaseNames);
  if (errors.length > 0) {
    throw new Error(`SVG validation failed:\n  ${errors.join('\n  ')}`);
  }

  const generatedEntries = missingMetadata.map((name) => [name, defaultMetadata(name, options)]);
  const versions = options.check ? [packageJson.version] : publishedVersions(packageJson.name);
  const newestPublished = versions.sort(compareVersions).at(-1) || packageJson.version;
  const baseline = compareVersions(packageJson.version, newestPublished) > 0 ? packageJson.version : newestPublished;
  const targetVersion = bumpVersion(baseline, options.bump);
  const localIsUnpublished = !versions.includes(packageJson.version) && compareVersions(packageJson.version, newestPublished) > 0;
  const unpushed = gitHasUnpushedCommits();

  if (!options.check && releaseNames.length > 0) {
    step(`Checking this checkout against npm ${newestPublished}`);
    assertPublishedBaseline(packageJson, newestPublished, completeNames);
    console.log('  ✓ No published icons or exports are missing locally');
  }

  if (!options.check && releaseNames.length === 0 && !localIsUnpublished && !unpushed) {
    console.log(`Nothing to release. ${packageJson.name}@${newestPublished} is published and the worktree has no icon changes.`);
    return;
  }

  if (options.dryRun) {
    console.log('Roc icon release plan');
    console.log(`  icons: ${releaseNames.length ? releaseNames.join(', ') : '(resume existing release)'}`);
    for (const [name, metadata] of generatedEntries) {
      console.log(`  metadata: ${name} → ${metadata.category}; ${metadata.tags.join(', ')}`);
    }
    console.log(`  version: ${localIsUnpublished && releaseNames.length === 0 ? packageJson.version : targetVersion}`);
    console.log(`  actions: validate, build, package-check${localIsUnpublished ? ', publish' : ', commit, tag, publish'}${options.deploy ? ', deploy preview' : ''}${options.push ? ', push' : ''}`);
    return;
  }

  if (!options.check) assertReleaseScope(pathsBeforeBuild);

  if (generatedEntries.length > 0) {
    step(`Adding metadata for ${formatNames(missingMetadata)}`);
    const updated = appendMetadataEntries(fs.readFileSync(ONTOLOGY_PATH, 'utf8'), generatedEntries);
    fs.writeFileSync(ONTOLOGY_PATH, updated);
  }

  step(`Validating the ${completeNames.length}-icon inventory${releaseNames.length ? ` and ${releaseNames.length} changed icon${releaseNames.length === 1 ? '' : 's'}` : ''}`);
  const inventoryErrors = validateInventory(readJson(ONTOLOGY_PATH));
  const postMetadataErrors = validateIconSet(releaseNames);
  const validationErrors = [...inventoryErrors, ...postMetadataErrors];
  if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'));
  console.log('  ✓ Four style variants and metadata are present for every icon');

  step('Building package outputs and preview');
  run('npm', ['run', 'build']);
  verifyGeneratedPackage(completeNames.length);

  step('Checking the packed package and Svelte exports');
  run('npm', ['run', 'verify:package']);

  if (options.check) {
    console.log('\n✓ Check complete. No version, commit, publish, deploy, or push was performed.');
    return;
  }

  let releaseVersion = packageJson.version;
  let shouldPublish = localIsUnpublished;

  if (releaseNames.length > 0) {
    const token = readNpmToken();
    if (!token) throw new Error('No npm automation token found. Set NPM_TOKEN or add NPM_TOKEN=… to ~/.secrets.');
    step('Checking npm authentication before changing git history');
    withNpmAuth(token, (env) => run('npm', ['whoami'], { env }));

    const added = releaseNames.every((name) => {
      const result = spawnSync('git', ['cat-file', '-e', `HEAD:src/svg/outline/${name}.svg`], { cwd: ROOT, stdio: 'ignore' });
      return result.status !== 0;
    });
    const commitMessage = options.message || `${added ? 'Add' : 'Update'} ${formatNames(releaseNames)} icon${releaseNames.length === 1 ? '' : 's'}`;

    step('Committing icon sources and generated preview');
    run('git', ['add', '--', 'src/svg', 'src/icons.json', 'demo/index.html']);
    run('git', ['commit', '-m', commitMessage]);

    releaseVersion = targetVersion;
    step(`Creating release v${releaseVersion} (npm latest is ${newestPublished})`);
    run('npm', ['version', releaseVersion, '-m', 'Release v%s']);
    shouldPublish = true;
  }

  if (shouldPublish) {
    const token = readNpmToken();
    if (!token) throw new Error('No npm automation token found. Set NPM_TOKEN or add NPM_TOKEN=… to ~/.secrets.');
    step(`Publishing ${packageJson.name}@${releaseVersion}`);
    withNpmAuth(token, (env) => run('npm', ['publish', '--access', 'public'], { env }));
  } else {
    console.log(`\n  ✓ ${packageJson.name}@${releaseVersion} is already published`);
  }

  if (options.deploy) {
    step('Deploying the public icon preview');
    run('npm', ['run', 'deploy']);
  }

  if (options.push) {
    step('Pushing the release commit and tag');
    run('git', ['push', '--follow-tags']);
  }

  console.log(`\n✓ Released ${packageJson.name}@${releaseVersion}${options.deploy ? ' and deployed the preview' : ''}.`);
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exitCode = 1;
  });
}

## MANDATORY: Use td for Task Management

You must run td usage --new-session at conversation start (or after /clear) to see current work.
Use td usage -q for subsequent reads.

## Publishing to npm

This library is published as `@marcusv/roc` on the public npm registry. Consumers (td-watch, perch, braid, etc.) install the published package, so **new icons are not available to them until a new version is published**.

### When to publish

Publish a new version every time you add or change icons — i.e. after the 4 SVG variants land, the `src/icons.json` entry is added, and `npm run build` passes. Don't leave new icons unpublished.

### Versioning

Adding icons is backward-compatible, so bump the **patch** version. Reserve `minor`/`major` for changes to existing icon names, exports, or build output.

Prefer patch bumps: consumers pin `@marcusv/roc` with a `^0.1.x` range, so patch releases are picked up automatically on their next install.

### Release steps

```sh
npm run build                 # must pass
npm version patch             # bumps package.json, commits, tags
NPM_TOKEN=$(grep NPM_TOKEN ~/.secrets | sed 's/.*=//') \
  npm publish --//registry.npmjs.org/:_authToken=$NPM_TOKEN
git push --follow-tags        # confirm with Marcus before pushing
```

`publishConfig.access` is set to `public`, so the scoped package publishes publicly without extra flags.

### 2FA caveat

The npm account (`marcusv`) has 2FA enabled. **Automated publishing only works if `NPM_TOKEN` in `~/.secrets` is an _Automation_ token** (Automation tokens bypass 2FA). A classic "Publish" token fails with `EOTP` and requires a human to complete the passkey/OTP prompt — if you hit `EOTP`, ask Marcus to either run the publish himself or swap in an Automation token.

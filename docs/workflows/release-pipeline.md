# OpenX Automatic Release Pipeline

OpenX production releases are automated by GitHub Actions in `.github/workflows/release.yml`.

The intended release action is:

```text
git push main
```

The workflow validates, tests, builds, packages, creates release metadata, uploads assets, and publishes a GitHub Release. No manual installer upload, checksum calculation, manifest editing, or release publishing is required.

## Pipeline Architecture

```text
Developer
  -> git push main
  -> GitHub Actions: OpenX Release
      -> checkout repository with tags
      -> setup Node 20
      -> restore npm/Electron/Playwright caches
      -> npm ci
      -> validate release environment
      -> npm run lint
      -> npm test
      -> validate package version and duplicate release state
      -> verify build resources
      -> npm run build
      -> npm run package
      -> locate installer
      -> calculate SHA256 and byte size
      -> generate release notes
      -> generate manifest.json
      -> upload workflow artifacts
      -> create draft GitHub Release
      -> upload installer, checksum, and manifest
      -> verify release assets
      -> publish release
      -> final release verification
```

The workflow creates the GitHub Release as a draft first. It publishes only after all required assets are uploaded and verified.

## Triggering

Supported triggers:

- `push` to `main`: normal production release flow.
- `push` of `v*` tags: supported for future tag-driven releases.
- `workflow_dispatch`: manual rerun with optional channel/status/minimum-version inputs.

Future scheduled builds can be added to the same workflow with an `on.schedule` block when nightly or periodic release candidates are needed.

## Versioning Strategy

The package version in `package.json` is the source of truth.

Example:

```json
{
  "version": "6.0.1"
}
```

The workflow derives:

```text
tag:          v6.0.1
release name: OpenX v6.0.1
```

Before building, `scripts/release/validate-release-version.js` verifies:

- `package.json` version is semantic version format.
- A pushed tag matches `package.json`.
- The GitHub Release for the version does not already exist.
- On `main`, the tag does not already exist.

If a release or tag already exists, the pipeline fails before publishing. Bump `package.json` for the next production release.

## Manifest Generation

`scripts/release/generate-release-manifest.js` generates `dist/manifest.json` from actual build output. It does not use a static template.

Generated fields include:

- `version`
- `minimumVersion`
- `releaseDate`
- `notes`
- `downloadUrl`
- `sha256`
- `size`
- `channel`
- `releaseStatus`
- `architecture`
- `platform`
- `installerName`
- `installerType`
- `checksumAlgorithm`
- `createdAt`
- `updatedAt`
- `signature`
- `metadata.buildNumber`
- `metadata.releaseNotes`

The top-level field is `notes` for compatibility with the Phase 2 Relay Server manifest validator. Full generated release notes are also included at `metadata.releaseNotes`.

The download URL is generated from GitHub Actions runtime metadata:

```text
GITHUB_SERVER_URL / GITHUB_REPOSITORY / releases / download / tag / installer asset
```

No repository URL is hardcoded.

## Asset Upload Process

`scripts/release/prepare-release-assets.js` scans `dist/` for release installers and selects the generated production installer. It supports:

- NSIS `.exe`
- future MSI `.msi`
- future ZIP/portable `.zip`

It calculates:

- SHA256 digest
- exact byte size
- human-readable size
- installer type
- architecture

Release assets uploaded:

```text
OpenX installer
installer.sha256
manifest.json
```

Workflow artifacts are also retained for 30 days:

```text
installer
checksum file
manifest.json
release-notes.md
```

## Required GitHub Secrets

Required:

```text
GITHUB_TOKEN
```

`GITHUB_TOKEN` is automatically provided by GitHub Actions and is used with least required permission:

```yaml
permissions:
  contents: write
  actions: read
```

Future optional secrets:

```text
WINDOWS_SIGNING_CERTIFICATE
WINDOWS_SIGNING_PASSWORD
NOTARIZATION_CREDENTIALS
RELEASE_PAT
```

Do not hardcode credentials, private URLs, PATs, signing secrets, or repository secrets in workflow files or scripts.

## Manual Rerun

Use GitHub Actions -> OpenX Release -> Re-run jobs when a transient dependency, GitHub API, or runner failure occurs before publish.

Use `workflow_dispatch` for an explicit manual run. Inputs:

- `channel`: `stable`, `beta`, or `alpha`.
- `release_status`: `published` or `prerelease`.
- `minimum_version`: optional override for manifest compatibility.

If a GitHub Release was already published, bump `package.json` before running again.

## Failed Release Recovery

Failure before release creation:

```text
Fix failure -> push commit to main
```

Failure while draft release exists:

```text
1. Inspect the failed workflow logs.
2. Inspect the draft GitHub Release.
3. Delete the draft release and tag if they are incomplete.
4. Re-run the workflow or push a fix.
```

Failure after release is published:

```text
1. Do not overwrite the published production release.
2. Create a hotfix commit.
3. Bump package.json patch version.
4. Push main.
5. Let the pipeline publish the hotfix release.
```

## Hotfix Release Flow

```text
git checkout main
git pull
apply fix
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release hotfix vX.Y.Z"
git push main
```

The pipeline creates `vX.Y.Z`, uploads the installer and manifest, and publishes the release.

## Runtime Boundaries

This pipeline does not modify or invoke runtime update behavior.

It does not:

- change the desktop update engine;
- change desktop IPC, UI, settings, or installer-download logic;
- change the relay update service or manifest cache;
- add update notifications;
- download installers at runtime;
- automatically install updates on user machines.

It only automates release publishing.

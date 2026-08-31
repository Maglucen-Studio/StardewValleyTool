# Contributing

Stardew Valley Tool uses a stable-main workflow. The default branch is intended to remain safe for ordinary users to clone and run.

## Branches

- `main` contains only approved, public-release quality versions.
- `development` integrates completed work for the next release.
- `feature/<short-name>` adds a user-facing capability.
- `fix/<short-name>` corrects a defect.
- `chore/<short-name>` covers maintenance, tooling, documentation, or packaging.

Do not commit feature work directly to `main` or `development`.

Read and follow [AGENTS.md](AGENTS.md), which applies to human contributors and automated development tools alike.

Never commit game assets, compiled bridge binaries, saves, generated snapshots, local history, logs, extracted data, or `config.local.json`. Public changes must remain portable and must not contain personal filesystem paths. All game imagery and data must be extracted from the user's own local installation at runtime.

## Development workflow

1. Update `development` and create a focused branch from it.

   ```shell
   git switch development
   git pull --ff-only
   git switch -c feature/example
   ```

2. Keep commits scoped to that feature and run the required checks.

   ```shell
   npm ci
   npm run verify:public
   npm run lint
   npm test
   ```

3. Open a pull request into `development` and use **Squash and merge** after review. The resulting commit should describe the completed outcome, not the implementation steps.

4. Delete the merged feature branch. Further work starts from the updated `development` branch.

Every pull request runs source checks, application tests, and a Windows packaging test. Use prerelease versions such as `1.9.0-beta.1` when a separately published test build is needed. The in-app updater intentionally reads only the stable GitHub Releases feed.

## Releases

When the accumulated work in `development` is approved:

1. Open a release pull request from `development` into `main`.
2. Merge only after the source, test, and Windows packaging checks pass.
3. Create the stable `v<version>` tag on the approved `main` commit.
4. Let the public release workflow build, attest, checksum, and publish the installer from that exact tag.
5. Test the published installer and bring any release-only metadata change back into `development` before beginning the next cycle.

Recommended repository rules should require pull requests and passing checks for both `main` and `development`, disallow force pushes, and restrict direct pushes to `main`.

## Optional live bridge

Changes to the SMAPI bridge can be checked locally with:

```powershell
dotnet build bridge/StardewValleyToolBridge/StardewValleyToolBridge.csproj -p:StardewPath="C:\path\to\Stardew Valley"
```

Describe user-visible changes and any assumptions about supported Stardew Valley or SMAPI versions in the pull request. By contributing code, you agree that it may be distributed under the repository's MIT License.

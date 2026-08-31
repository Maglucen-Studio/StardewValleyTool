# Code signing policy

Maglucen Stardew Valley Companion is applying for **Free code signing provided by SignPath.io, certificate by SignPath Foundation**. Until that application is accepted and the release workflow is connected to SignPath, published Windows installers remain unsigned and are identified as such in the release notes.

## Scope

Only release artifacts built from this public repository may be submitted for signing. The signed product name must be **Maglucen Stardew Valley Companion**, and the product version must match the version in `package.json` and the corresponding `v<version>` Git tag.

The project does not use its signing entitlement to sign third-party binaries. Open-source dependencies and operating-system components may be included in a release where their licenses permit it, but retain their original publisher and signature state.

## Roles

The project currently has one maintainer, [@maglucen](https://github.com/maglucen), who holds these responsibilities:

- **Author/committer:** may modify project source through the protected repository workflow.
- **Reviewer:** reviews contributions from people without commit access before they are merged.
- **Approver:** manually reviews and approves every SignPath production-signing request.

Automated checks do not replace the required human approval of a signing request. If the maintainer list changes, this policy and the corresponding SignPath roles must be updated before a new member can submit or approve signatures.

## Release and approval process

1. Feature and maintenance changes are merged into `development` through pull requests with the required checks passing.
2. A release pull request promotes the approved state from `development` to protected `main`.
3. The release version in `package.json` and the `v<version>` tag must agree.
4. GitHub Actions builds the Windows installer from that public tag on a GitHub-hosted runner.
5. The unsigned artifact is submitted to SignPath through its GitHub trusted-build integration.
6. The approver verifies the tag, commit, checks, product name, version, and expected artifact before manually approving the signing request.
7. Only the signed artifact returned by SignPath is published. The release also contains SHA-256 checksums and build-provenance information.

No signing request may bypass branch protection, the public tagged build, required checks, or manual approval.

## Security

All repository maintainers and SignPath users must use multi-factor authentication. Credentials and API tokens are stored only as encrypted repository or environment secrets and are never committed to source control.

Security vulnerabilities should be reported using the private process in [SECURITY.md](SECURITY.md).

## Privacy

The application processes save data locally and has no telemetry or hosted user account. It contacts GitHub for release checks and downloads only when the user uses the update functionality. Diagnostic information leaves the computer only when the user chooses to include it in a support report. See [PRIVACY.md](PRIVACY.md) for the complete policy.


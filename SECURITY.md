# Security policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose save data, execute unintended code, compromise the update path, or modify a user's game installation.

Use GitHub's private vulnerability reporting feature for this repository. Include the affected version, reproduction steps, expected impact, and any relevant logs with personal paths and save data removed.

Ordinary bugs and feature requests should use the public issue templates.

## Security boundaries

Maglucen Stardew Valley Companion is designed to:

- process save and LIVE data locally;
- read original saves without modifying them;
- extract required Stardew Valley assets from the user's own local installation;
- install only the documented optional SMAPI bridge;
- retrieve application updates from the official GitHub Releases feed.

Reports that show a violation of one of these boundaries are especially valuable.

## Supported versions

Security fixes are delivered through the latest stable release. Users should update through the application's update checker or the official GitHub Releases page.

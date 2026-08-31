# Third-party software

Maglucen Stardew Valley Companion is distributed under the MIT License and uses third-party open-source software. The authoritative dependency versions are recorded in `package-lock.json` and the .NET project files.

Principal runtime components include:

- Electron — MIT License
- React and React DOM — MIT License
- electron-updater — MIT License
- json5 — MIT License
- pngjs — MIT License
- xnb — LGPL-3.0-or-later
- Python — Python Software Foundation License
- Pillow — HPND License

Development and packaging also use Vite, TypeScript, ESLint, electron-builder, and their transitive dependencies under their respective licenses.

Stardew Valley, SMAPI, and their assets are not licensed under this repository's MIT License. The project does not distribute Stardew Valley assets or game assemblies. It reads the user's legitimate local installation, and the bridge build uses public API-only reference assemblies in continuous integration.

Copyright and license notices supplied by dependencies remain applicable. Run `npm ci` against the committed lockfile to reproduce the JavaScript dependency set used by the build.

import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(({ command }) => ({
  // The local public directory contains private runtime data and game assets.
  // Production builds add only the explicitly approved icons afterwards.
  publicDir: command === "build" ? false : undefined,
  server: {
    watch: {
      ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      // Windows locks compiler outputs while local .NET helpers are rebuilt.
      ignored: ["**/.local/**", "**/obj/**", "**/bin/**", "**/release/**"],
    },
  },
  plugins: [vinext()],
}));

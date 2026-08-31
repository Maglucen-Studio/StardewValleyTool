import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "./config.mjs";

const output = resolve(projectRoot, "dist");
if (!existsSync(output)) throw new Error("Build output is missing. Run vinext build first.");
mkdirSync(resolve(output, "assets"), { recursive: true });
mkdirSync(resolve(output, "data", "days"), { recursive: true });
copyFileSync(resolve(projectRoot, "public", "favicon.png"), resolve(output, "favicon.png"));
copyFileSync(resolve(projectRoot, "public", "app-icon.png"), resolve(output, "app-icon.png"));

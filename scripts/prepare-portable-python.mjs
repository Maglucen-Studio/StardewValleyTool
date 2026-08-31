import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const PYTHON_VERSION = "3.13.7";
const PILLOW_VERSION = "11.3.0";
const project = resolve(import.meta.dirname, "..");
const cache = join(project, ".cache", "portable-python");
const archive = join(cache, `python-${PYTHON_VERSION}-embed-amd64.zip`);
const pillowWheel = join(cache, `pillow-${PILLOW_VERSION}-cp313-cp313-win_amd64.whl`);
const destination = join(project, "desktop", "resources", "python");
const python = join(destination, "python.exe");
const marker = join(destination, `.ready-${PYTHON_VERSION}-${PILLOW_VERSION}`);

const downloads = [
  {
    url: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
    output: archive,
    sha256: "f6cca216a359be84797cabb54149ce5e062afb16cc7567eb7fc51cacb2d86b65",
  },
  {
    url: "https://files.pythonhosted.org/packages/23/85/397c73524e0cd212067e0c969aa245b01d50183439550d24d9f55781b776/pillow-11.3.0-cp313-cp313-win_amd64.whl",
    output: pillowWheel,
    sha256: "0bce5c4fd0921f99d2e858dc4d4d64193407e1b99478bc5cacecba2311abde51",
  },
];

function verifyHash(contents, expected, label) {
  const actual = createHash("sha256").update(contents).digest("hex");
  if (actual !== expected) {
    throw new Error(`SHA-256 mismatch for ${label}: expected ${expected}, got ${actual}`);
  }
}

async function download({ url, output, sha256 }) {
  if (existsSync(output)) {
    verifyHash(readFileSync(output), sha256, output);
    return;
  }
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const contents = Buffer.from(await response.arrayBuffer());
  verifyHash(contents, sha256, url);
  writeFileSync(output, contents);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: project, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

if (!existsSync(marker)) {
  mkdirSync(cache, { recursive: true });
  for (const artifact of downloads) await download(artifact);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  run("tar.exe", ["-xf", archive, "-C", destination]);

  const pathFile = join(destination, "python313._pth");
  const pathConfig = readFileSync(pathFile, "utf8").replace(/^#import site$/m, "import site");
  writeFileSync(pathFile, pathConfig, "utf8");
  const sitePackages = join(destination, "Lib", "site-packages");
  mkdirSync(sitePackages, { recursive: true });
  run("tar.exe", ["-xf", pillowWheel, "-C", sitePackages]);
  writeFileSync(marker, "Portable runtime prepared.\n", "utf8");
}

run(python, ["-c", "import PIL; print('Portable Python and Pillow ready:', PIL.__version__)"]);

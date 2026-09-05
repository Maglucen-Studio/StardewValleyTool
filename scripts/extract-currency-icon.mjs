import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";

export async function extractCurrencyIcon(runtimeRoot) {
  const sheet = PNG.sync.read(await readFile(resolve(runtimeRoot, "assetbuild/unpacked/debris.png")));
  // The game's gold-price tooltip uses tile 8 of TileSheets/debris (16px tiles).
  const columns = Math.floor(sheet.width / 16);
  const x = (8 % columns) * 16;
  const y = Math.floor(8 / columns) * 16;
  const icon = new PNG({ width: 16, height: 16 });
  PNG.bitblt(sheet, icon, x, y, 16, 16, 0, 0);
  // The coin occupies the center of its tile; trim excess transparent space.
  let left = 16, top = 16, right = -1, bottom = -1;
  for (let row = 0; row < 16; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      if (!icon.data[(row * 16 + column) * 4 + 3]) continue;
      left = Math.min(left, column); top = Math.min(top, row);
      right = Math.max(right, column); bottom = Math.max(bottom, row);
    }
  }
  if (right < left) throw new Error("The local currency sprite is empty.");
  const size = Math.max(right - left + 1, bottom - top + 1) + 2;
  const cropped = new PNG({ width: size, height: size });
  PNG.bitblt(icon, cropped, left, top, right - left + 1, bottom - top + 1, 1, 1);
  const directory = resolve(runtimeRoot, "public/assets/sprites");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "gold.png"), PNG.sync.write(cropped));
}

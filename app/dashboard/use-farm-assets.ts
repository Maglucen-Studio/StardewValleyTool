"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import type { Snapshot } from "./snapshot-types";
import { spritePaths } from "./farm-rendering";
export function useFarmAssets(data: Snapshot | null) {
  const { t } = useI18n();
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [sprites, setSprites] = useState<Record<string, HTMLImageElement>>({});
  const [assetError, setAssetError] = useState("");
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    Object.entries(spritePaths).forEach(([name, path]) => {
      const asset = new Image();
      let settled = false;
      const finish = (loaded: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (loaded) setSprites((previous) => ({ ...previous, [name]: loaded }));
      };
      const timeout = window.setTimeout(() => finish(null), 8000);
      asset.onload = () => finish(asset);
      asset.onerror = () => finish(null);
      asset.src = path;
      cleanups.push(() => {
        settled = true;
        window.clearTimeout(timeout);
        asset.onload = null;
        asset.onerror = null;
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  useEffect(() => {
    const path = data?.locationMaps?.Farm?.background;
    if (!path) return;
    const image = new Image();
    image.onload = () => {
      setBase(image);
      setAssetError("");
    };
    image.onerror = () =>
      setAssetError(
        t("error.farmBackground"),
      );
    image.src = path;
    return () => { image.onload = null; image.onerror = null; };
  }, [data?.locationMaps?.Farm?.background, t]);

  return { base, sprites, assetError };
}

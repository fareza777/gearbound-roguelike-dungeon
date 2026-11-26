export interface SpriteAnimMeta {
  file: string;
  frames: number;
}

export interface SpriteUnitMeta {
  frameWidth: number;
  frameHeight: number;
  anims: Record<string, SpriteAnimMeta>;
}

export type SpriteManifest = Record<string, SpriteUnitMeta>;

class AssetCache {
  private images = new Map<string, HTMLImageElement>();
  private loading = new Map<string, Promise<HTMLImageElement | null>>();
  manifest: SpriteManifest = {};
  private manifestLoaded = false;

  async loadManifest(): Promise<SpriteManifest> {
    if (this.manifestLoaded) return this.manifest;
    try {
      const res = await fetch('./assets/sprites/manifest.json');
      this.manifest = (await res.json()) as SpriteManifest;
      this.manifestLoaded = true;
    } catch {
      this.manifest = {};
    }
    return this.manifest;
  }

  getImage(path: string): HTMLImageElement | null {
    const existing = this.images.get(path);
    if (existing && existing.complete && existing.naturalWidth > 0) {
      return existing;
    }
    if (!this.loading.has(path)) {
      const p = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images.set(path, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = path;
      });
      this.loading.set(path, p);
    }
    return null;
  }

  async preload(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map((p) => {
        if (this.images.has(p)) return Promise.resolve(this.images.get(p)!);
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.images.set(p, img);
            resolve(img);
          };
          img.onerror = () => resolve(null);
          img.src = p;
        });
      })
    );
  }

  async preloadUnit(unitId: string): Promise<void> {
    await this.loadManifest();
    const meta = this.manifest[unitId];
    if (!meta) return;
    await this.preload(Object.values(meta.anims).map((a) => a.file));
  }
}

export const assetCache = new AssetCache();

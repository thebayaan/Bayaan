import sharp from 'sharp';
import {rgbaToThumbHash} from 'thumbhash';

// The files a reciter photo upload consists of (see bayaan-backend
// docs/uploads.md): a 512 px and a 160 px square WebP, plus a ThumbHash the
// app shows while the photo loads or when it is offline. The backend derives
// the thumb's key as `…-160.webp` (src/lib/reciterPhoto.ts); keep the sizes in step.

export const FULL_SIZE = 512;
export const THUMB_SIZE = 160;
const QUALITY = 80;
// ThumbHash works on images of at most 100 × 100
const HASH_SIZE = 100;

export interface PhotoVariants {
  full: Buffer;
  thumb: Buffer;
  placeholder: string;
}

/** A centred square crop of any image, as the two WebP files and the placeholder. */
export async function makeVariants(source: Buffer): Promise<PhotoVariants> {
  // EXIF rotation applied, metadata dropped, transparency on white. sharp keeps
  // only the last resize of a pipeline, so each size resizes the original.
  const base = sharp(source).rotate().flatten({background: '#ffffff'});
  const square = (size: number) =>
    base.clone().resize(size, size, {fit: 'cover', position: 'centre'});

  const [full, thumb, hashPixels] = await Promise.all([
    square(FULL_SIZE).webp({quality: QUALITY}).toBuffer(),
    square(THUMB_SIZE).webp({quality: QUALITY}).toBuffer(),
    square(HASH_SIZE).ensureAlpha().raw().toBuffer(),
  ]);
  const hash = rgbaToThumbHash(HASH_SIZE, HASH_SIZE, hashPixels);
  return {full, thumb, placeholder: Buffer.from(hash).toString('base64')};
}

/**
 * R2ObjectStore — the production audio cache (Cloudflare R2, S3-compatible).
 *
 * R2 has zero egress fees, which is the dominant infra-cost lever for an all-voice
 * app re-serving the same cached teacher audio (PLAN.md §8). Implements the
 * ObjectStore interface the ElevenLabs TTS provider depends on. Credentials come
 * from env at construction — never hard-coded. Not run in CI (no live bucket).
 */

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStore } from '@suara/providers';

export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** public/CDN base URL for serving cached audio, e.g. https://cdn.suara.app */
  publicBaseUrl: string;
}

export class R2ObjectStore implements ObjectStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(opts: R2Options) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
    this.bucket = opts.bucket;
    this.publicBaseUrl = opts.publicBaseUrl.replace(/\/$/, '');
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (e) {
      // Only a genuine "not found" is a cache miss. Auth/network/throttle errors must
      // propagate — swallowing them would silently re-synthesize + re-PUT every line,
      // defeating the cost cache (CLAUDE.md §8).
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  }

  url(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}

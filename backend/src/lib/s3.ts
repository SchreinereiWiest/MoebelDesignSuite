import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const s3Config = {
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
};

// Server-side traffic uses the Docker-internal endpoint. Presigned URLs must
// instead contain a hostname that is resolvable by the user's browser.
export const s3 = new S3Client({
  ...s3Config,
  endpoint: env.S3_ENDPOINT,
});

const s3Presigner = new S3Client({
  ...s3Config,
  endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
  // A presigned browser upload has no body yet. The SDK's default CRC32 for
  // an empty body would otherwise be embedded in the URL and rejected by
  // Garage as soon as the browser sends the actual file contents.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;

    if (statusCode !== 404 || !env.S3_AUTO_CREATE_BUCKET) {
      throw error;
    }

    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

export function createUploadUrl(input: {
  objectKey: string;
  contentType: string;
}) {
  return getSignedUrl(
    s3Presigner,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: env.S3_SIGNED_URL_TTL_SECONDS },
  );
}

export function createDownloadUrl(objectKey: string) {
  return getSignedUrl(
    s3Presigner,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    { expiresIn: env.S3_SIGNED_URL_TTL_SECONDS },
  );
}

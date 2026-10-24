import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
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
    s3,
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
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    { expiresIn: env.S3_SIGNED_URL_TTL_SECONDS },
  );
}

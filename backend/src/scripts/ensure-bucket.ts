import { env } from "../config/env.js";
import { ensureBucket, s3 } from "../lib/s3.js";

await ensureBucket();
console.log(`Bucket \"${env.S3_BUCKET}\" is available at ${env.S3_ENDPOINT}`);
s3.destroy();

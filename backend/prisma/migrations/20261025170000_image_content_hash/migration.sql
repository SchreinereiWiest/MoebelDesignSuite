ALTER TABLE "images"
ADD COLUMN "content_hash" VARCHAR(64);

CREATE INDEX "images_owner_tenant_id_content_hash_idx"
ON "images"("owner_tenant_id", "content_hash");

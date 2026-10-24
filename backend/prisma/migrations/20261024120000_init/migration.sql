-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING_UPLOAD', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ImageVariantKind" AS ENUM ('THUMBNAIL', 'PREVIEW');

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_variants" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "kind" "ImageVariantKind" NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "image_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_tags" (
    "image_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_tags_pkey" PRIMARY KEY ("image_id","tag_id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "images_object_key_key" ON "images"("object_key");
CREATE INDEX "images_status_idx" ON "images"("status");
CREATE INDEX "images_created_at_idx" ON "images"("created_at");
CREATE UNIQUE INDEX "image_variants_object_key_key" ON "image_variants"("object_key");
CREATE INDEX "image_variants_image_id_idx" ON "image_variants"("image_id");
CREATE UNIQUE INDEX "image_variants_image_id_kind_key" ON "image_variants"("image_id", "kind");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE INDEX "image_tags_tag_id_idx" ON "image_tags"("tag_id");
CREATE INDEX "collections_created_at_idx" ON "collections"("created_at");
CREATE INDEX "collection_items_collection_id_sort_order_idx" ON "collection_items"("collection_id", "sort_order");
CREATE INDEX "collection_items_image_id_idx" ON "collection_items"("image_id");
CREATE UNIQUE INDEX "collection_items_collection_id_image_id_key" ON "collection_items"("collection_id", "image_id");

ALTER TABLE "image_variants" ADD CONSTRAINT "image_variants_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

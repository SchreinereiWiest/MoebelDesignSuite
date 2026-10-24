-- CreateEnum
CREATE TYPE "ImageVisibility" AS ENUM ('PRIVATE', 'RESTRICTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('ROOM', 'FURNITURE', 'MATERIAL', 'COLOR', 'STYLE', 'FEATURE', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ItemRating" AS ENUM ('LIKE', 'DISLIKE');

-- AlterTable
ALTER TABLE "images"
ADD COLUMN "title" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "visibility" "ImageVisibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "tags"
ADD COLUMN "category" "TagCategory" NOT NULL DEFAULT 'FEATURE';

UPDATE "tags"
SET "category" = 'TECHNICAL'
WHERE "slug" IN ('querformat', 'hochformat', 'quadratisch') OR "slug" LIKE 'format-%';

-- AlterTable
ALTER TABLE "collection_items"
ADD COLUMN "note" TEXT,
ADD COLUMN "rating" "ItemRating";

-- CreateIndex
CREATE INDEX "images_visibility_idx" ON "images"("visibility");

-- CreateIndex
CREATE INDEX "tags_category_idx" ON "tags"("category");

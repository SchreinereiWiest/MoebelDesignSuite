CREATE TYPE "TagProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'MERGED', 'REJECTED');
CREATE TYPE "LibraryDensity" AS ENUM ('COMFORTABLE', 'COMPACT');

ALTER TABLE "images"
  ADD COLUMN "owner_tenant_id" UUID,
  ADD COLUMN "owner_user_id" UUID,
  ADD COLUMN "rights_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "rights_confirmed_by" UUID;

CREATE INDEX "images_owner_tenant_id_visibility_idx"
  ON "images"("owner_tenant_id", "visibility");

ALTER TABLE "collections"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "user_id" UUID;

CREATE INDEX "collections_tenant_id_user_id_updated_at_idx"
  ON "collections"("tenant_id", "user_id", "updated_at");

ALTER TABLE "tags" ADD COLUMN "normalized_name" TEXT;
UPDATE "tags" SET "normalized_name" = "slug" WHERE "normalized_name" IS NULL;
UPDATE "tags" SET "normalized_name" = 'kuche' WHERE "slug" = 'kueche';
UPDATE "tags" SET "normalized_name" = 'sitzmobel' WHERE "slug" = 'sitzmoebel';
UPDATE "tags" SET "normalized_name" = 'salbeigrun' WHERE "slug" = 'salbeigruen';
UPDATE "tags" SET "normalized_name" = 'naturlich' WHERE "slug" = 'natuerlich';
UPDATE "tags" SET "normalized_name" = 'schiebetur' WHERE "slug" = 'schiebetuer';
UPDATE "tags" SET "normalized_name" = 'grifflose front' WHERE "slug" = 'grifflose-front';
UPDATE "tags" SET "normalized_name" = 'offenes regal' WHERE "slug" = 'offenes-regal';
UPDATE "tags" SET "normalized_name" = 'led beleuchtung' WHERE "slug" = 'led-beleuchtung';
UPDATE "tags" SET "normalized_name" = 'runde kanten' WHERE "slug" = 'runde-kanten';
ALTER TABLE "tags" ALTER COLUMN "normalized_name" SET NOT NULL;
CREATE UNIQUE INDEX "tags_normalized_name_key" ON "tags"("normalized_name");

INSERT INTO "tags" ("id", "name", "slug", "normalized_name", "category", "created_at") VALUES
  (gen_random_uuid(), 'Küche', 'kueche', 'kuche', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Wohnzimmer', 'wohnzimmer', 'wohnzimmer', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Schlafzimmer', 'schlafzimmer', 'schlafzimmer', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Ankleide', 'ankleide', 'ankleide', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Bad', 'bad', 'bad', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Homeoffice', 'homeoffice', 'homeoffice', 'ROOM', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Einbauschrank', 'einbauschrank', 'einbauschrank', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sideboard', 'sideboard', 'sideboard', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Regal', 'regal', 'regal', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Tisch', 'tisch', 'tisch', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sitzmöbel', 'sitzmoebel', 'sitzmobel', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Raumteiler', 'raumteiler', 'raumteiler', 'FURNITURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Eiche', 'eiche', 'eiche', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Nussbaum', 'nussbaum', 'nussbaum', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Esche', 'esche', 'esche', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Lack', 'lack', 'lack', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Naturstein', 'naturstein', 'naturstein', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Metall', 'metall', 'metall', 'MATERIAL', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Warmweiß', 'warmweiss', 'warmweiss', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sand', 'sand', 'sand', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Greige', 'greige', 'greige', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Salbeigrün', 'salbeigruen', 'salbeigrun', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Anthrazit', 'anthrazit', 'anthrazit', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Terrakotta', 'terrakotta', 'terrakotta', 'COLOR', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Zeitlos', 'zeitlos', 'zeitlos', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Minimalistisch', 'minimalistisch', 'minimalistisch', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Japandi', 'japandi', 'japandi', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Skandinavisch', 'skandinavisch', 'skandinavisch', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Modern', 'modern', 'modern', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Natürlich', 'natuerlich', 'naturlich', 'STYLE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Grifflose Front', 'grifflose-front', 'grifflose front', 'FEATURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Rahmenfront', 'rahmenfront', 'rahmenfront', 'FEATURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Offenes Regal', 'offenes-regal', 'offenes regal', 'FEATURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Schiebetür', 'schiebetuer', 'schiebetur', 'FEATURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'LED-Beleuchtung', 'led-beleuchtung', 'led beleuchtung', 'FEATURE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Runde Kanten', 'runde-kanten', 'runde kanten', 'FEATURE', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

CREATE TABLE "tag_aliases" (
  "id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tag_aliases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tag_aliases_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tag_aliases_normalized_name_key" ON "tag_aliases"("normalized_name");
CREATE INDEX "tag_aliases_tag_id_idx" ON "tag_aliases"("tag_id");

CREATE TABLE "tag_proposals" (
  "id" UUID NOT NULL,
  "proposed_name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "category" "TagCategory" NOT NULL,
  "tenant_id" UUID NOT NULL,
  "proposed_by" UUID NOT NULL,
  "status" "TagProposalStatus" NOT NULL DEFAULT 'PENDING',
  "resolved_tag_id" UUID,
  "decision_note" TEXT,
  "resolved_by" UUID,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tag_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tag_proposals_resolved_tag_id_fkey" FOREIGN KEY ("resolved_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "tag_proposals_tenant_id_status_idx" ON "tag_proposals"("tenant_id", "status");
CREATE INDEX "tag_proposals_normalized_name_idx" ON "tag_proposals"("normalized_name");

CREATE TABLE "tenant_settings" (
  "tenant_id" UUID NOT NULL,
  "library_density" "LibraryDensity" NOT NULL DEFAULT 'COMFORTABLE',
  "default_visibility" "ImageVisibility" NOT NULL DEFAULT 'PRIVATE',
  "show_external_images" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id")
);

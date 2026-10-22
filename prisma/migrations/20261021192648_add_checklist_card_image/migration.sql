-- Adds an admin-set default image per checklist row, shown until a real
-- logged gel's own photo is available (which takes precedence).

ALTER TABLE "ChecklistCard" ADD COLUMN     "imageUrl" TEXT;

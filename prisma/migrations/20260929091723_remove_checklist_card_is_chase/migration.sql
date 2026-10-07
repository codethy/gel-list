-- Removes ChecklistCard.isChase: every checklist row imported onto this
-- platform is intentionally a chase card already (base cards are excluded
-- from the source checklist before import), so the flag carried no
-- information and every row had it hardcoded to true.
ALTER TABLE "ChecklistCard" DROP COLUMN "isChase";

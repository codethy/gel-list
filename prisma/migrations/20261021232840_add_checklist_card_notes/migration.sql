-- Adds an admin-only notes field on ChecklistCard, shown in the public
-- checklist's "Notes" column — distinct from PortfolioCard.notes (a
-- user's own note about their logged gel, which only appears in that
-- gel's Card History from now on).

ALTER TABLE "ChecklistCard" ADD COLUMN     "notes" TEXT;

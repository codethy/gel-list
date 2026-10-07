-- Enables Postgres's built-in `unaccent` extension so search queries can
-- strip diacritics (e.g. "Joao" matching "João") — used by
-- app/api/sets/[id]/checklist/route.ts's search.
CREATE EXTENSION IF NOT EXISTS unaccent;

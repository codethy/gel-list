-- Adds the "someone else's gel" acquisition sources (Who pulled it?) to the
-- existing AcquisitionMethod enum, alongside the original PULLED/BOUGHT
-- values used for the logging user's own gels.
ALTER TYPE "AcquisitionMethod" ADD VALUE 'BREAKER';
ALTER TYPE "AcquisitionMethod" ADD VALUE 'EBAY';
ALTER TYPE "AcquisitionMethod" ADD VALUE 'FRIEND';
ALTER TYPE "AcquisitionMethod" ADD VALUE 'SOCIAL_MEDIA';
ALTER TYPE "AcquisitionMethod" ADD VALUE 'OTHER';

-- Editable website copy (home, about, page intros, footer) stored as one validated JSON object.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "siteCopy" JSONB;

-- The application validates the shape; the database guarantees it is an object.
ALTER TABLE "Company" ADD CONSTRAINT "Company_siteCopy_object" CHECK ("siteCopy" IS NULL OR jsonb_typeof("siteCopy") = 'object');

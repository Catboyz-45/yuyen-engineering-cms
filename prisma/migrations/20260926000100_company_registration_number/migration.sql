-- Juristic person registration number shown in the public footer and structured data.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "registrationNumber" VARCHAR(13);

-- The application also verifies the check digit; the database guarantees 13 digits.
ALTER TABLE "Company" ADD CONSTRAINT "Company_registrationNumber_digits" CHECK ("registrationNumber" IS NULL OR "registrationNumber" ~ '^[0-9]{13}$');

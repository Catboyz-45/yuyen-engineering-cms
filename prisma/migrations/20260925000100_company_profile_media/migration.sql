-- Company values text and an ordered photo gallery for the About page.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "values" TEXT;

-- CreateTable
CREATE TABLE "CompanyMedia" (
    "companyId" VARCHAR(30) NOT NULL,
    "mediaId" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyMedia_pkey" PRIMARY KEY ("companyId","mediaId")
);

-- CreateIndex
CREATE INDEX "CompanyMedia_mediaId_idx" ON "CompanyMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMedia_companyId_sortOrder_key" ON "CompanyMedia"("companyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CompanyMedia" ADD CONSTRAINT "CompanyMedia_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMedia" ADD CONSTRAINT "CompanyMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match the other gallery tables.
ALTER TABLE "CompanyMedia" ADD CONSTRAINT "CompanyMedia_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);

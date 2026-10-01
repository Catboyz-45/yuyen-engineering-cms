-- Optional brand logo for the home-page brand strip. Brands without a logo show their name.

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "logoMediaId" VARCHAR(30);

-- CreateIndex
CREATE INDEX "Brand_logoMediaId_idx" ON "Brand"("logoMediaId");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;


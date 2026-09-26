-- Services gain an ordered image gallery, like products and projects.

-- CreateTable
CREATE TABLE "ServiceMedia" (
    "serviceId" VARCHAR(30) NOT NULL,
    "mediaId" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceMedia_pkey" PRIMARY KEY ("serviceId","mediaId")
);

-- CreateIndex
CREATE INDEX "ServiceMedia_mediaId_idx" ON "ServiceMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMedia_serviceId_sortOrder_key" ON "ServiceMedia"("serviceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Same guarantee as the product and project galleries.
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);

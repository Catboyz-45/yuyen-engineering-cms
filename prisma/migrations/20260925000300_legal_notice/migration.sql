-- Company-confirmed privacy notice details and Super Admin approval, replacing
-- the LEGAL_NOTICE_APPROVED / PRIVACY_CONTACT_EMAIL environment variables.

-- CreateTable
CREATE TABLE "LegalNotice" (
    "id" VARCHAR(30) NOT NULL,
    "singletonKey" VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    "privacyEmail" VARCHAR(254),
    "serviceProviders" TEXT,
    "retention" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "approvedRevision" VARCHAR(40),
    "approvedById" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalNotice_singletonKey_key" ON "LegalNotice"("singletonKey");

-- CreateIndex
CREATE INDEX "LegalNotice_approvedById_idx" ON "LegalNotice"("approvedById");

-- AddForeignKey
ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An approved notice must name a privacy contact, the service providers and the retention periods.
ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_approval_complete" CHECK (
  "approvedAt" IS NULL OR (
    "approvedRevision" IS NOT NULL
    AND "privacyEmail" IS NOT NULL
    AND "serviceProviders" IS NOT NULL
    AND "retention" IS NOT NULL
  )
);

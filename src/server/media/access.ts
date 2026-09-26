import type { Prisma } from "@prisma/client";

// Media is public only while something published references it; one query checks every relation with EXISTS.
export function publicReference(): Prisma.MediaWhereInput {
  const published = { status: "PUBLISHED" as const, deletedAt: null, publishedAt: { lte: new Date() } };
  return { OR: [
    { companyLogos: { some: {} } }, { brandLogos: { some: { isActive: true, deletedAt: null } } }, { companyGallery: { some: {} } }, { bannerImages: { some: published } }, { serviceCovers: { some: published } },
    { serviceGallery: { some: { service: published } } },
    { productCovers: { some: published } }, { productCatalogs: { some: published } }, { productGallery: { some: { product: published } } },
    { projectCovers: { some: published } }, { projectGallery: { some: { project: published } } }, { newsCovers: { some: published } },
  ] };
}

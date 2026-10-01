/**
 * หน้าที่ของไฟล์นี้: คำสั่งดูแลระบบ purge-expired-content; รันจากเครื่องหรือเซิร์ฟเวอร์ที่เชื่อถือได้ตามคู่มือใน docs
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import "dotenv/config";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { db } from "../src/server/db/client";
import { anonymizedAdminData } from "../src/server/auth/admin-retention";

async function main() {
  const now = new Date(); let purged = 0;
  // Administrator rows stay as audit anchors; only their personal data and credentials are removed.
  const expiredAdmins = await db.admin.findMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } }, select: { id: true } });
  for (const admin of expiredAdmins) {
    const passwordHash = await argon2.hash(randomBytes(32).toString("base64url"), { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await db.$transaction([
      db.recoveryCode.deleteMany({ where: { adminId: admin.id } }), db.session.deleteMany({ where: { adminId: admin.id } }),
      db.admin.update({ where: { id: admin.id }, data: anonymizedAdminData(admin.id, passwordHash) }),
      db.auditLog.create({ data: { action: "ADMIN_DELETED_PERMANENTLY", targetType: "Admin", targetId: admin.id, result: "SUCCESS", metadata: { source: "retention-job" } } }),
    ]);
  }
  await db.$transaction(async tx => {
    const [banners, products, projects, news] = await Promise.all([
      tx.banner.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.product.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.project.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.news.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
    ]);
    purged += banners.count + products.count + projects.count + news.count;
    const services = await tx.service.findMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, projects: { none: {} } }, select: { id: true } });
    if (services.length) { await tx.service.deleteMany({ where: { id: { in: services.map(item => item.id) } } }); purged += services.length; }
    const brands = await tx.brand.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, products: { none: {} } } });
    const types = await tx.productType.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, products: { none: {} } } });
    const categories = await tx.newsCategory.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, news: { none: {} } } });
    purged += brands.count + types.count + categories.count;
    await tx.auditLog.create({ data: { action: "RETENTION_PURGE_COMPLETED", targetType: "System", result: "SUCCESS", metadata: { purged, anonymizedAdmins: expiredAdmins.length } } });
  });
  process.stdout.write(`Purged ${purged} expired records and anonymized ${expiredAdmins.length} administrator accounts.\n`);
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Cleanup failed"}\n`); process.exitCode = 1; }).finally(() => db.$disconnect());

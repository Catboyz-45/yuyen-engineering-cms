import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/server/auth/permissions";
import { clientIp, isSameOrigin } from "@/server/security/request";
import { errorDetails } from "@/server/observability/logger";

describe("RBAC permission matrix", () => {
  const content: Permission[] = ["CMS_READ", "CMS_WRITE", "MEDIA_WRITE"];
  it.each(content)("allows Editor to %s", permission => expect(can(AdminRole.EDITOR, permission)).toBe(true));
  it.each(["ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"] as Permission[])("denies Editor permission %s", permission => expect(can(AdminRole.EDITOR, permission)).toBe(false));
  it.each(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE", "ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"] as Permission[])("allows Super Admin permission %s", permission => expect(can(AdminRole.SUPER_ADMIN, permission)).toBe(true));
});

describe("request security", () => {
  it("accepts only an exact origin match", () => {
    expect(isSameOrigin("https://cms.example.com", "https://cms.example.com/admin")).toBe(true);
    expect(isSameOrigin("https://evil.example.com", "https://cms.example.com")).toBe(false);
    expect(isSameOrigin("https://cms.example.com.evil.test", "https://cms.example.com")).toBe(false);
    expect(isSameOrigin(null, "https://cms.example.com")).toBe(false);
    expect(isSameOrigin("not a url", "https://cms.example.com")).toBe(false);
  });
  it("reads the client address written by the outermost trusted proxy only", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "7.7.7.7" });
    expect(clientIp(headers, 1)).toBe("203.0.113.9");
    expect(clientIp(headers, 2)).toBe("6.6.6.6");
    expect(clientIp(headers, 0)).toBeNull();
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }), 1)).toBe("198.51.100.4");
    expect(clientIp(new Headers(), 1)).toBeNull();
  });
  it("does not expose stack traces through normalized error details", () => {
    const details = errorDetails(new Error("database unavailable"));
    expect(details).toEqual({ errorName: "Error", errorMessage: "database unavailable" });
    expect(details).not.toHaveProperty("stack");
  });
});

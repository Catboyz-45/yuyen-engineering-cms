export class CmsError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "INVALID_MEDIA" | "IN_USE" | "FORBIDDEN" | "LAST_SUPER_ADMIN", message: string) { super(message); }
}

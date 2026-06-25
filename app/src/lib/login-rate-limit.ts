export function getLoginRateLimitIdentifier(ipAddress: string, email: FormDataEntryValue | null): string {
  const normalizedIp = ipAddress.trim() || "unknown";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  return `login:${normalizedIp}:${normalizedEmail || "missing-email"}`;
}

/**
 * RoleGate — Server Component for fine-grained UI-level role enforcement.
 *
 * ⚠️  UX ONLY: This component controls what the user SEES, not what they can DO.
 * All mutations MUST be guarded by requireWriteAccess() / requireApproveAccess()
 * in the corresponding Server Action or API handler.
 *
 * Usage:
 *   <RoleGate session={session} allowedRoles={["OWNER", "ADMIN"]}>
 *     <AdminPanel />
 *   </RoleGate>
 */
import type { AuthSession } from "@/lib/session";
import type { Role } from "@/lib/nav-config";
import { Shield } from "lucide-react";

interface RoleGateProps {
  session: AuthSession;
  allowedRoles: Role[];
  children: React.ReactNode;
  /** Optional: custom message shown when access is denied */
  deniedMessage?: string;
}

export default function RoleGate({
  session,
  allowedRoles,
  children,
  deniedMessage,
}: RoleGateProps) {
  const hasAccess = allowedRoles.includes(session.user.role as Role);

  if (!hasAccess) {
    return (
      <div
        role="alert"
        aria-label="Access restricted"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "48px 24px",
          background: "rgba(22,39,80,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(22,39,80,0.10)",
          color: "var(--ax-blue)",
          textAlign: "center",
        }}
      >
        <Shield size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>Access Restricted</div>
        <div style={{ fontSize: 13, opacity: 0.65, maxWidth: 340 }}>
          {deniedMessage ??
            `This section requires one of: ${allowedRoles.join(", ")}. Your current role is ${session.user.role}.`}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

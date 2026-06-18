import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/session";

export default async function PostLoginPage() {
  const session = await getRequiredSession();
  redirect(session.user.role === "SUPER_ADMIN" ? "/platform" : "/command-center");
}

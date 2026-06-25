"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { updateSession } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession } from "@/lib/session";

export async function changePasswordAction(formData: FormData) {
  const session = await getRequiredSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirect("/change-password?error=New%20password%20must%20be%20at%20least%208%20characters.");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=New%20password%20and%20confirmation%20do%20not%20match.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    redirect("/change-password?error=Your%20account%20does%20not%20have%20a%20password%20configured.");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    redirect("/change-password?error=Current%20password%20is%20incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      forcePasswordChange: false,
    },
  });

  await updateSession({ user: { forcePasswordChange: false } });
  redirect("/post-login");
}

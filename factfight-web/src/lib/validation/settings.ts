import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(80, "Display name must be 80 characters or fewer."),
  bio: z.string().trim().max(160, "Bio must be 160 characters or fewer."),
  profileVisibility: z.enum(["public", "private"]),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .superRefine((values, context) => {
    if (values.newPassword === values.currentPassword) {
      context.addIssue({ code: "custom", message: "New password must be different.", path: ["newPassword"] });
    }
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({ code: "custom", message: "Passwords don't match.", path: ["confirmPassword"] });
    }
  });

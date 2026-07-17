import { z } from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeUsername = (value: string) =>
  value.trim().replace(/^@+/, "").toLowerCase();

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email("Enter a valid email address."));

const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(USERNAME_MIN_LENGTH, "Username must be 3-20 characters.")
      .max(USERNAME_MAX_LENGTH, "Username must be 3-20 characters.")
      .regex(
        /^[a-z0-9_]+$/,
        "Username can only use letters, numbers, and underscores.",
      ),
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(
    DISPLAY_NAME_MAX_LENGTH,
    `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const signupSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    email: emailSchema,
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      ),
    confirmPassword: z.string().min(1, "Confirm your password."),
    termsAccepted: z.preprocess(
      (value) => value === true || value === "true" || value === "on",
      z.literal(true, {
        error: "You must agree to the Terms of Use to continue.",
      }),
    ),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

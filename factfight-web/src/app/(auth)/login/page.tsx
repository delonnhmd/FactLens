import { LoginForm } from "@/components/auth/login-form";

const callbackMessages: Record<string, string> = {
  missing_code: "The sign-in link is incomplete. Request a new link and try again.",
  callback_failed: "The sign-in link could not be completed. It may have expired.",
  session_invalid: "Your sign-in could not be verified. Please try again.",
  profile_unavailable: "Your account is valid, but your profile could not be prepared right now.",
  terms_unavailable: "Your account is valid, but terms acceptance could not be recorded right now.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";

  return <LoginForm callbackMessage={callbackMessages[errorCode]} />;
}

import { LoginForm } from "@/components/auth/login-form";
import { getSafeInternalDestination } from "@/lib/utils/redirects";

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
  searchParams: Promise<{ error?: string | string[]; next?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const nextPath = getSafeInternalDestination(typeof params.next === "string" ? params.next : null);
  const statusMessage = params.status === "password_updated"
    ? "Password updated. Log in with your new password."
    : params.status === "account_deleted"
      ? "Your account was deleted and your public contributions were anonymized."
      : undefined;

  return <LoginForm callbackMessage={callbackMessages[errorCode] ?? statusMessage} nextPath={nextPath} />;
}

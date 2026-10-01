import { lovable } from "@/integrations/lovable/index";

/** Starts Google sign-in via the managed cloud auth helper. */
export async function signInWithGoogle(): Promise<void> {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Google 로그인에 실패했습니다.");
  }

  if (result.redirected) {
    // Browser is navigating to Google; nothing else to do here.
    return;
  }
}

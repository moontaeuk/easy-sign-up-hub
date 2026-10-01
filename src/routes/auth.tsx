import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — Ledger" },
      { name: "description", content: "Google 계정으로 로그인하고 월별 가격 장부를 이어서 사용하세요." },
      { property: "og:title", content: "로그인 — Ledger" },
      { property: "og:description", content: "Google 계정으로 로그인하고 월별 가격 장부를 이어서 사용하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleGoogle() {
    try {
      setPending(true);
      await signInWithGoogle();
    } catch (error) {
      setPending(false);
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="frosted w-full max-w-sm rounded-2xl p-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-md bg-foreground font-display text-sm font-extrabold text-background">
            L
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight">Ledger</span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight">
          다시 오신 걸 환영해요
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Google 계정으로 로그인하면 지난 기록을 그대로 이어서 볼 수 있어요.
        </p>

        <button
          onClick={handleGoogle}
          disabled={pending}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-rule bg-background py-2.5 px-3 text-sm font-medium text-foreground transition hover:-translate-y-px disabled:opacity-60"
        >
          <span className="num text-[15px] font-semibold text-rise">G</span>
          {pending ? "이동 중…" : "Google로 계속하기"}
        </button>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          로그인만으로 가입이 완료됩니다.
        </p>
      </div>
    </div>
  );
}

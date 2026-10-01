import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledger — 월별 가격 기록" },
      {
        name: "description",
        content:
          "자주 사는 물건의 가격을 매달 기록하고, 전월 대비 변화를 한눈에 확인하세요. Google 로그인으로 바로 시작할 수 있어요.",
      },
      { property: "og:title", content: "Ledger — 월별 가격 기록" },
      {
        property: "og:description",
        content: "매달 가격을 기록하고 변화를 한눈에 보는 개인 가격 트래킹 서비스",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function handleGoogle() {
    try {
      setPending(true);
      await signInWithGoogle();
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-rule bg-panel backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-foreground font-display text-sm font-extrabold text-background">
              L
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">Ledger</span>
          </div>
          {signedIn ? (
            <Link
              to="/dashboard"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
            >
              내 장부 열기
            </Link>
          ) : (
            <button
              onClick={handleGoogle}
              disabled={pending}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
            >
              {pending ? "이동 중…" : "로그인"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="grid gap-10 py-14 lg:grid-cols-2 lg:items-center">
          <div className="animate-rise">
            <p className="num text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Personal price ledger
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
              모든 가격,
              <br />
              질서 있게 기록하세요.
            </h1>
            <p className="mt-4 max-w-[42ch] text-pretty text-[15px] leading-relaxed text-muted-foreground">
              자주 사는 물건의 가격을 매달 한 칸씩 기록하고, 소음 없이 변화만 읽어보세요. 내 장부는
              나에게만 보입니다.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="frosted rounded-2xl p-6 sm:col-span-2">
              <p className="num text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                내 장부 시작하기
              </p>
              {signedIn ? (
                <Link
                  to="/dashboard"
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
                >
                  내 장부 열기
                </Link>
              ) : (
                <button
                  onClick={handleGoogle}
                  disabled={pending}
                  className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-rule bg-background py-2.5 px-3 text-sm font-medium text-foreground transition hover:-translate-y-px disabled:opacity-60"
                >
                  <span className="num text-[15px] font-semibold text-rise">G</span>
                  Google로 계속하기
                </button>
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                별도 가입 절차 없이 Google 계정으로 바로 이용할 수 있어요.
              </p>
            </div>

            <div className="frosted rounded-2xl p-6 sm:col-span-2">
              <p className="num text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                이용 방법
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-3">
                  <span className="num mt-0.5 text-[12px] text-primary">01</span>
                  <span>자주 사는 상품을 추가하세요.</span>
                </li>
                <li className="flex gap-3">
                  <span className="num mt-0.5 text-[12px] text-primary">02</span>
                  <span>매달 가격을 한 칸에 기록하세요.</span>
                </li>
                <li className="flex gap-3">
                  <span className="num mt-0.5 text-[12px] text-primary">03</span>
                  <span>전월 대비 변화를 한눈에 확인하세요.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-panel backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-5 num text-[11px] text-muted-foreground">
          <span>Ledger · 기록은 비공개로 보관됩니다.</span>
          <span>가격은 직접 입력한 값입니다.</span>
        </div>
      </footer>
    </div>
  );
}

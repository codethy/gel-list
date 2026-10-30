"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SignInBox from "@/components/SignInBox";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <SignInBox callbackUrl={callbackUrl} />
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}

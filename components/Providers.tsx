"use client";

import { SessionProvider } from "next-auth/react";
import NameSetupModal from "@/components/NameSetupModal";
import WelcomeModal from "@/components/WelcomeModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <NameSetupModal />
      <WelcomeModal />
    </SessionProvider>
  );
}

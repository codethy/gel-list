"use client";

import { SessionProvider } from "next-auth/react";
import NameSetupModal from "@/components/NameSetupModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <NameSetupModal />
    </SessionProvider>
  );
}

"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { Button } from "./ui";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiPost("/auth/logout");
        } catch {
          /* egal — Cookie ggf. schon weg */
        }
        window.location.assign("/login");
      }}
    >
      Abmelden
    </Button>
  );
}

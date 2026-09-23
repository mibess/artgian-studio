"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "../../lib/auth-client";
export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="max-w-36 shrink-0">
      <button
        type="button"
        disabled={pending}
        aria-label={pending ? "Saindo da conta" : "Sair da conta"}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-[#647087] transition hover:bg-[#0b2447]/5 hover:text-[#0b2447] disabled:opacity-50"
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error();
            router.replace("/login");
            router.refresh();
          } catch {
            setError("Não foi possível sair. Tente novamente.");
            setPending(false);
          }
        }}
      >
        <LogOut size={15} aria-hidden="true" />
        {pending ? "Saindo…" : <span>Sair<span className="hidden sm:inline"> da conta</span></span>}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";
export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-full border border-[#0b2447]/20 px-6 py-3 text-sm font-semibold disabled:opacity-50"
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
        {pending ? "Saindo…" : "Sair da conta"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

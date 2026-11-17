"use client";
import { useState } from "react";
export default function UploadPage() {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [imageId, setImageId] = useState("");
  return <main className="mx-auto max-w-xl px-5 py-16 text-[#193244]"><h1 className="font-serif text-4xl">Enviar foto do produto</h1><p className="my-6">Escolha PNG, JPEG ou WebP de até 2 MB. Depois de enviar, volte à sua IA para concluir o cadastro.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage("");
      try {
        const file = new FormData(e.currentTarget).get("image");
        if (!(file instanceof File) || !file.size) throw new Error("Escolha uma imagem.");
        const token = location.hash.slice(1);
        if (!token) throw new Error("Link inválido. Peça um novo link à sua IA.");
        const response = await fetch("/api/mcp/images", { method: "POST", headers: { "x-upload-token": token, "content-type": file.type }, body: file });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error_description || "Falha ao enviar.");
        setImageId(result.imageId); setMessage("Foto recebida. Volte à sua IA para cadastrar o produto.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao enviar."); }
      finally { setBusy(false); }
    }}><label className="block">Foto do produto<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required disabled={busy} className="my-4 block w-full" /></label><button disabled={busy} className="rounded-xl bg-[#193244] px-6 py-3 text-white">{busy ? "Enviando…" : "Enviar imagem"}</button></form>
    <p role="status" className="my-6">{message}</p>{imageId && <p className="break-all text-sm">Identificador da imagem: {imageId}</p>}
  </main>;
}

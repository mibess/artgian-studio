import { WHATSAPP_URL } from "../../lib/custom-order";

export default function FloatingWhatsApp() {
  return (
    <a
      data-floating-whatsapp=""
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale com a Artgian pelo WhatsApp (abre em nova aba)"
      title="Fale com a Artgian pelo WhatsApp"
      className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-[#087d45] text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#066738] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b2447]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-7">
        <path
          d="M21 11.8a9 9 0 0 1-13.3 7.9L3 21l1.3-4.6A9 9 0 1 1 21 11.8Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M8.3 7.5c-.7 0-1.4.8-1.4 1.8 0 2.8 3.9 6.7 6.9 7.3 1.6.3 3-.7 3.2-1.7.1-.3 0-.5-.3-.6l-2.2-1.1c-.3-.1-.5-.1-.7.2l-.8 1c-1.6-.6-2.9-1.8-3.5-3.3l.7-.8c.2-.2.2-.4.1-.7l-.9-1.9c-.1-.2-.3-.3-.5-.3h-.6Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}

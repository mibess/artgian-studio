const MARK = "/artgian-logo-mark.png";

type PrintingLogoProps = {
  /** "page": full printer (frame, rail and bed) for loading screens.
   *  "compact": just the head and the layers, sized to fit the header badge. */
  variant?: "page" | "compact";
  className?: string;
};

/**
 * A 3D printer laying down the Artgian monogram layer by layer. Pure CSS
 * (see "Printing logo" in globals.css), so it already runs in the streamed
 * loading HTML before any JavaScript arrives. Decorative: callers announce
 * the loading state in text.
 */
export default function PrintingLogo({ variant = "page", className = "" }: PrintingLogoProps) {
  return (
    <span className={`print-logo print-logo--${variant} ${className}`} aria-hidden="true">
      <span className="print-machine">
        {variant === "page" && <span className="print-frame" />}
        <span className="print-area">
          <span className="print-cycle">
            <span className="print-done">
              <img alt="" className="print-mark" src={MARK} />
              <span className="print-lines" />
              <span className="print-shine" />
            </span>
            <span className="print-layer">
              <span className="print-sweep">
                <span className="print-layer-image">
                  <img alt="" className="print-mark" src={MARK} />
                </span>
              </span>
            </span>
          </span>
          <span className="print-gantry">
            {variant === "page" && <span className="print-rail" />}
            <span className="print-head">
              <svg viewBox="0 0 28 32">
                <rect x="1" y="0" width="26" height="15" rx="4" fill="#0b2447" />
                <rect x="5" y="4" width="18" height="2.6" rx="1.3" fill="#d8bc7b" />
                <path d="M8.5 15h11l-2.2 6.5h-6.6z" fill="#b88a3b" />
                <path d="M11.6 21.5h4.8L14 26z" fill="#d8bc7b" />
                <circle className="print-nozzle-glow" cx="14" cy="28.6" r="2.2" fill="#f0c568" />
              </svg>
            </span>
          </span>
        </span>
        {variant === "page" && <span className="print-bed" />}
      </span>
    </span>
  );
}

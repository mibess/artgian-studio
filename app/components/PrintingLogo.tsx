export const LOGO_MARK = "/artgian-logo-mark.png";

/**
 * The monogram filling in from the bottom like a 3D print: a faint copy shows
 * the model, a thin gold line rises with the fill and a glint glides along it.
 * Pure CSS ("Printing logo" in globals.css), so it already runs in the streamed
 * loading HTML. Size it with a width or height class; it keeps the logo's
 * proportions. Decorative: callers announce the loading state in text.
 */
export default function PrintingLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`print-logo ${className}`} aria-hidden="true">
      <img alt="" className="print-ghost" src={LOGO_MARK} />
      <img alt="" className="print-printed" src={LOGO_MARK} />
      <span className="print-front">
        <span className="print-line" />
        <span className="print-nozzle" />
      </span>
    </span>
  );
}

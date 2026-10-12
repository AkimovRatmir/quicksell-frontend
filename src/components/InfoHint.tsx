/** Иконка «i» с всплывающей подсказкой — прячет детали, не занимая место. */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="info-hint" tabIndex={0} aria-label={text}>
      i
      <span className="info-pop">{text}</span>
    </span>
  );
}

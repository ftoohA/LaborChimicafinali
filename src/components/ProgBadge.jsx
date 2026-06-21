export default function ProgBadge({ type, T }) {
  const labels = {
    daily: T.prog_daily,
    location: T.prog_location,
    brazer: T.prog_brazer,
    amazon: T.prog_amazon,
    macro: T.prog_macro,
  };
  return (
    <span className={`prog-badge pb-${type || 'daily'}`}>
      {labels[type] || labels.daily}
    </span>
  );
}

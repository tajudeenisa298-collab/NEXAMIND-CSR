type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning";
};

export function StatCard({ label, value, detail, tone = "default" }: StatCardProps) {
  const loading = value === "...";

  return (
    <div className={`card stat ${loading ? "is-loading" : ""}`}>
      <span className={tone === "default" ? "badge" : `badge ${tone}`}>{label}</span>
      <span className="stat-value" aria-busy={loading}>
        {loading ? <span className="skeleton-value" /> : value}
      </span>
      <span className="muted">{detail}</span>
    </div>
  );
}

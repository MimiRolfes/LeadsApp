import styles from "./priority-badge.module.css";

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className={styles.none}>—</span>;
  const label =
    priority === "hot" ? "Hot" : priority === "warm" ? "Warm" : "Cold";
  return (
    <span className={styles.badge} data-p={priority}>
      {label}
    </span>
  );
}

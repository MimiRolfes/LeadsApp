import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import styles from "./ui.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  block,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
}) {
  return (
    <button
      className={[
        styles.button,
        styles[variant],
        block ? styles.block : "",
        className ?? "",
      ].join(" ")}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  block,
  href,
  children,
}: {
  variant?: Variant;
  block?: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        styles.button,
        styles[variant],
        block ? styles.block : "",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function FieldShell({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  id: string;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  id: string;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} className={styles.textarea} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  id: string;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} className={styles.select} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const cls =
    kind === "error"
      ? styles.alertError
      : kind === "success"
        ? styles.alertSuccess
        : styles.alertInfo;
  return (
    <div
      className={`${styles.alert} ${cls}`}
      role={kind === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const Row = ({ children }: { children: ReactNode }) => (
  <div className={styles.row}>{children}</div>
);

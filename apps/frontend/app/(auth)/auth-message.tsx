import type { ReactNode } from "react";
import styles from "./auth.module.css";

/**
 * Fehler-/Erfolgsmeldung im Auth-Design. Bewusst NICHT die geteilte
 * `<Alert>`-Komponente (die gehört zum internen "Liquid Glass"-Dashboard —
 * durchsichtig, geblurrt, Inter). Figma zeigt keinen Fehlerzustand; diese
 * Variante bleibt konsequent bei der Formsprache der Auth-Screens: flache
 * Farbfläche, Radius wie die Eingabefelder, Inria Serif.
 */
export function AuthMessage({
  kind = "error",
  children,
}: {
  kind?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      className={`${styles.message} ${kind === "success" ? styles.messageSuccess : styles.messageError}`}
      role={kind === "error" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

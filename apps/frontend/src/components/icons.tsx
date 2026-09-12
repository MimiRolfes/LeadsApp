/**
 * Die Icons der Home-Screens, 1:1 aus Figma exportiert
 * (public/icons/nav/*.svg — Material-Symbols-Geometrie aus dem
 * Material 3 Design Kit, das der Entwurf referenziert).
 *
 * Eingebunden als CSS-Maske statt als <img>: so bleibt die Datei das
 * Asset, die Farbe kommt aber aus `currentColor` und folgt damit dem
 * Hell/Dunkel-Modus. Größe setzt die aufrufende Klasse.
 */
import styles from "./icons.module.css";

type IconProps = { className?: string };

function maskIcon(variant: string | undefined) {
  return function Icon({ className }: IconProps) {
    return (
      <span
        aria-hidden="true"
        className={[styles.icon, variant, className].filter(Boolean).join(" ")}
      />
    );
  };
}

export const IconToday = maskIcon(styles.today);
export const IconGroups = maskIcon(styles.groups);
export const IconMail = maskIcon(styles.mail);
export const IconCheckBox = maskIcon(styles.checkBox);
export const IconAccountCircle = maskIcon(styles.accountCircle);
export const IconAdd = maskIcon(styles.add);

import { NewEventForm } from "./new-event-form";

/**
 * Vollseite unter /events/new — greift, wenn die Adresse direkt aufgerufen
 * wird oder JavaScript nicht läuft. Aus der Übersicht heraus öffnet der
 * "+"-Knopf stattdessen das Overlay, ohne die Seite zu wechseln.
 */
export default function NewEventPage() {
  return <NewEventForm />;
}

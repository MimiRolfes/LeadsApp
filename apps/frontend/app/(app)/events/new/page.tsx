import { NewEventForm } from "./new-event-form";

/**
 * Vollseite unter /events/new — greift, wenn die Adresse direkt aufgerufen
 * oder neu geladen wird. Aus der Übersicht heraus fängt die Route in
 * app/(app)/@modal/(.)events/new das Ziel ab und zeigt stattdessen das
 * Overlay.
 */
export default function NewEventPage() {
  return <NewEventForm />;
}

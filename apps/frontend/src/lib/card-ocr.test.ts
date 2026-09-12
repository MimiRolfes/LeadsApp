import { describe, expect, it } from "vitest";
import { parseCardText } from "./card-ocr";

/**
 * Der Parser bekommt fehlerbehafteten Text aus der Texterkennung. Wichtig
 * ist weniger, dass er alles findet, als dass er nichts Falsches einträgt —
 * die Werte gehen als Vorschlag in die Maske.
 *
 * Alle Beispiele sind frei erfunden (keine echten Kontaktdaten).
 */
describe("parseCardText", () => {
  it("liest eine übliche deutsche Karte", () => {
    const fields = parseCardText(
      [
        "Musterwerk GmbH",
        "Anna Beispiel",
        "Leiterin Vertrieb",
        "Tel. +49 89 1234567",
        "a.beispiel@musterwerk.example",
        "Musterstraße 1, 80331 München",
      ].join("\n"),
    );

    expect(fields).toMatchObject({
      firstName: "Anna",
      lastName: "Beispiel",
      company: "Musterwerk GmbH",
      position: "Leiterin Vertrieb",
      email: "a.beispiel@musterwerk.example",
    });
    expect(fields.phone?.replace(/\D/g, "")).toBe("49891234567");
  });

  it("nimmt die Telefonnummer nicht aus der E-Mail-Zeile", () => {
    const fields = parseCardText(
      ["kontakt@firma24-7.example", "Mobil 0170 9876543"].join("\n"),
    );
    expect(fields.email).toBe("kontakt@firma24-7.example");
    expect(fields.phone?.replace(/\D/g, "")).toBe("01709876543");
  });

  it("entfernt Anrede und Titel aus dem Namen", () => {
    const fields = parseCardText("Dr. Jonas Waldner\nBeispiel AG");
    expect(fields.firstName).toBe("Jonas");
    expect(fields.lastName).toBe("Waldner");
  });

  it("leitet die Firma aus der E-Mail-Domain ab, wenn die Rechtsform fehlt", () => {
    const fields = parseCardText(
      ["Mindsewn", "Lea Hartkopf", "lea@mindsewn.example"].join("\n"),
    );
    expect(fields.company).toBe("Mindsewn");
    expect(fields.lastName).toBe("Hartkopf");
  });

  it("hält Adress- und Kontaktzeilen vom Namen fern", () => {
    const fields = parseCardText(
      ["Telefon Zentrale", "www.beispiel.example", "Bahnhofstraße 12"].join(
        "\n",
      ),
    );
    expect(fields.firstName).toBeUndefined();
    expect(fields.lastName).toBeUndefined();
  });

  it("liefert bei unlesbarem Text nichts statt Unsinn", () => {
    const fields = parseCardText("~~~ ### ??? \n |||");
    expect(fields).toEqual({});
  });
});

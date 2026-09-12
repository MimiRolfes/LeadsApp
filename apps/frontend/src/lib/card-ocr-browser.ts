"use client";

import {
  parseCardText,
  type CardRecognitionResult,
  type CardRecognizer,
} from "./card-ocr";

/**
 * Texterkennung im Browser (Tesseract, WebAssembly).
 *
 * Läuft vollständig auf dem Gerät — das Foto wird weder hochgeladen noch
 * gespeichert. Worker, Kern und Sprachmodelle liegen unter /ocr/ im eigenen
 * Auslieferungsverzeichnis: kein Aufruf bei Dritten, und nach dem ersten
 * Laden funktioniert die Erkennung auch ohne Verbindung — wichtig auf der
 * Messe, wo das Netz oft schlecht ist.
 *
 * Die schnellen Sprachmodelle (tessdata_fast) sind bewusst gewählt: 2,7 MB
 * statt 17 MB bei kaum schlechterer Erkennung auf gedruckten Karten.
 */

const OCR_BASE = "/ocr";
const LANGS = "deu+eng";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

/** Der Worker wird einmal aufgebaut und danach wiederverwendet. */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker(LANGS, 1, {
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: `${OCR_BASE}/tesseract-core-simd-lstm.wasm.js`,
        langPath: OCR_BASE,
        gzip: true,
      });
    })().catch((err) => {
      // Fehlgeschlagenen Aufbau nicht zwischenspeichern, sonst schlägt jeder
      // weitere Versuch ohne echten Grund fehl.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export const browserCardRecognizer: CardRecognizer = {
  async recognize(image: Blob): Promise<CardRecognitionResult> {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    const text = data.text ?? "";
    return { fields: parseCardText(text), text };
  },
};

/** Gibt den Worker frei (z. B. beim Verlassen der Erfassungsseite). */
export async function releaseCardRecognizer(): Promise<void> {
  const pending = workerPromise;
  if (!pending) return;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    /* schon weg */
  }
}

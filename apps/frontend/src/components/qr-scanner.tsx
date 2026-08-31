"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import styles from "./qr-scanner.module.css";

/**
 * Kamera-QR-Scanner als Vollbild-Overlay. Nutzt die native `BarcodeDetector`-
 * API wo vorhanden (Chrome/Android), sonst `jsQR` auf Canvas-Frames (iOS
 * Safari, Firefox). Liefert den Rohinhalt des ersten erkannten Codes.
 *
 * Voraussetzung: sicherer Kontext (https oder localhost) — sonst gibt der
 * Browser keinen Kamerazugriff frei.
 */

// BarcodeDetector ist noch nicht in der TS-DOM-Lib — minimales lokales Typing.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof w.BarcodeDetector === "function" ? w.BarcodeDetector : null;
}

type Status = "starting" | "scanning" | "error";

export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (raw: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<Status>("starting");
  const [errorText, setErrorText] = useState("");

  const stop = useCallback(() => {
    doneRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    (raw: string) => {
      if (doneRef.current) return;
      stop();
      onResult(raw);
    },
    [onResult, stop],
  );

  useEffect(() => {
    doneRef.current = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("error");
      setErrorText(
        !window.isSecureContext
          ? "Kamera braucht eine sichere Verbindung (https). Über localhost oder die installierte App funktioniert es."
          : "Dieser Browser gibt keinen Kamerazugriff frei.",
      );
      return;
    }

    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorText(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Kamerazugriff wurde abgelehnt. In den Browser-Einstellungen erlauben und erneut versuchen."
            : "Keine Kamera gefunden oder Zugriff nicht möglich.",
        );
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (cancelled) return;
      setStatus("scanning");

      const detector = getBarcodeDetectorCtor();
      const nativeDetector = detector
        ? new detector({ formats: ["qr_code"] })
        : null;

      const tick = async () => {
        if (doneRef.current) return;
        const canvas = canvasRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w && h) {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              try {
                if (nativeDetector) {
                  const codes = await nativeDetector.detect(canvas);
                  const value = codes.find((c) => c.rawValue)?.rawValue;
                  if (value) return finish(value);
                } else {
                  const img = ctx.getImageData(0, 0, w, h);
                  const found = jsQR(img.data, w, h, {
                    inversionAttempts: "dontInvert",
                  });
                  if (found?.data) return finish(found.data);
                }
              } catch {
                /* einzelner Frame nicht dekodierbar → nächster Versuch */
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [finish, stop]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="QR-Code scannen"
    >
      <div className={styles.frameWrap}>
        <video ref={videoRef} className={styles.video} playsInline muted />
        <canvas ref={canvasRef} className={styles.canvas} />
        {status === "scanning" ? (
          <div className={styles.reticle} aria-hidden="true" />
        ) : null}
      </div>

      <div className={styles.bar}>
        <p className={styles.hint}>
          {status === "starting"
            ? "Kamera wird gestartet…"
            : status === "scanning"
              ? "Badge-QR-Code in den Rahmen halten"
              : errorText}
        </p>
        <button
          type="button"
          className={styles.close}
          onClick={() => {
            stop();
            onClose();
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Inria_Serif } from "next/font/google";
import { APP_NAME } from "@humatter-leads/shared";
import { ServiceWorkerRegister } from "@/components/service-worker";
import "./globals.css";

/**
 * Läuft vor dem ersten Paint: wendet die gespeicherte Hell/Dunkel-Wahl an,
 * damit die App nicht kurz im falschen Modus aufblitzt. Muss mit
 * `THEME_STORAGE_KEY` in src/lib/theme.ts übereinstimmen ("hl-theme").
 */
const THEME_INIT_SCRIPT =
  "try{var t=localStorage.getItem('hl-theme');" +
  "if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const inriaSerif = Inria_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-inria-serif",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Interne, mobile-first Lead-Capture- und Lead-Management-App für Messeauftritte von humatter.",
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Leads",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e0e3f3" },
    { media: "(prefers-color-scheme: dark)", color: "#070a1c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${inriaSerif.variable}`}
      // Das Inline-Skript setzt data-theme vor der Hydration — erwarteter
      // Server/Client-Unterschied genau auf diesem Element.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

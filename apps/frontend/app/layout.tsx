import type { Metadata, Viewport } from "next";
import { Inter, Inria_Serif } from "next/font/google";
import { APP_NAME } from "@humatter-leads/shared";
import { ServiceWorkerRegister } from "@/components/service-worker";
import "./globals.css";

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
  appleWebApp: { capable: true, title: "Leads", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#001540",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} ${inriaSerif.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

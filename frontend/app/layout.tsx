import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "HYPE Productions — Client Cloud",
  description: "Private cloud sharing for HYPE Productions clients.",
};

const BARION_PIXEL_ID = process.env.NEXT_PUBLIC_BARION_PIXEL_ID || "";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hu" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="grain font-sans antialiased">
        {/* Barion Base Pixel — csak ha van beállítva Pixel ID */}
        {BARION_PIXEL_ID && (
          <Script id="barion-pixel" strategy="afterInteractive">
            {`
              window["bp"] = window["bp"] || function () {
                (window["bp"].q = window["bp"].q || []).push(arguments);
              };
              window["bp"].l = 1 * new Date();
              var scriptElement = document.createElement("script");
              var firstScript = document.getElementsByTagName("script")[0];
              scriptElement.async = true;
              scriptElement.src = "https://pixel.barion.com/bp.js";
              firstScript.parentNode.insertBefore(scriptElement, firstScript);
              window["barion_pixel_id"] = "${BARION_PIXEL_ID}";
              bp("init", "addBarionPixelId", window["barion_pixel_id"]);
            `}
          </Script>
        )}
        {children}
      </body>
    </html>
  );
}

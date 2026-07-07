import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import { GlobalMediaLightbox } from "@/components/layout/GlobalMediaLightbox";

export const metadata: Metadata = {
  title: `${APP_NAME} - ${COMPANY_NAME}`,
  description: "6S audit, findings, CAPA, analytics and reporting portal",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalMediaLightbox />
      </body>
    </html>
  );
}

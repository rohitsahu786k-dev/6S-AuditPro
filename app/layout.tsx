import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import { GlobalMediaLightbox } from "@/components/layout/GlobalMediaLightbox";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam-pro"
});

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
    <html lang="en" className={beVietnamPro.variable}>
      <body>
        {children}
        <GlobalMediaLightbox />
      </body>
    </html>
  );
}

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "./header";
import { Footer } from "./footer";
import { WhatsAppButton } from "./whatsapp-button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
    if (i18n.language === "ar") {
      document.body.style.fontFamily = "'Cairo', sans-serif";
    } else {
      document.body.style.fontFamily = "'Inter', sans-serif";
    }
  }, [i18n.language]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/lib/api";

export default function About() {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSiteSettings();

  const isArabic = i18n.language === "ar";
  const title = isArabic ? settings?.about_title_ar : settings?.about_title_en;
  const content = isArabic ? settings?.about_text_ar : settings?.about_text_en;

  return (
    <div className="min-h-[80vh] flex flex-col">
      <div className="relative w-full h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden bg-zinc-950">
        <img 
          src="/images/about.png" 
          alt="Our Workshop" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tight">
            {title || t("about.title")}
          </h1>
          <div className="h-2 w-24 bg-primary mx-auto mt-6"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-screen-md py-20 flex-1">
        <div className="prose prose-zinc dark:prose-invert prose-lg max-w-none">
          {content ? (
            <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium" dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className="text-center text-muted-foreground py-12">
              Content is being updated.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/lib/api";

export function Footer() {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSiteSettings();

  const isArabic = i18n.language === "ar";
  const companyName = isArabic
    ? settings?.company_name_ar || "MotoWebsite"
    : settings?.company_name_en || "MotoWebsite";
  
  const address = isArabic ? settings?.address_ar : settings?.address_en;

  return (
    <footer className="border-t bg-muted/40 py-12 mt-auto">
      <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-black text-primary mb-4">{companyName}</h3>
            {address && <p className="text-muted-foreground mb-2 whitespace-pre-line">{address}</p>}
            {settings?.email && <p className="text-muted-foreground mb-1">{settings.email}</p>}
            {settings?.phone && <p className="text-muted-foreground">{settings.phone}</p>}
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-4">{t("footer.follow_us")}</h4>
            <div className="flex flex-col space-y-2">
              {settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">Facebook</a>}
              {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">Instagram</a>}
              {settings?.twitter_url && <a href={settings.twitter_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">Twitter</a>}
              {settings?.youtube_url && <a href={settings.youtube_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">YouTube</a>}
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-4">{t("home.download_app")}</h4>
            <div className="flex flex-col space-y-3">
              {settings?.google_play_url && (
                <a href={settings.google_play_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90">
                  Google Play
                </a>
              )}
              {settings?.app_store_url && (
                <a href={settings.app_store_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90">
                  App Store
                </a>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {companyName}. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}
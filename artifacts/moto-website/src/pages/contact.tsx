import { useTranslation } from "react-i18next";
import { useSiteSettings, useContact } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, Send } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSiteSettings();
  const { toast } = useToast();
  const contactMutation = useContact();
  const isArabic = i18n.language === "ar";
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });

  const address = isArabic ? settings?.address_ar : settings?.address_en;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactMutation.mutate(formData, {
      onSuccess: () => {
        toast({
          title: t("contact.success"),
          variant: "default",
        });
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      },
      onError: () => {
        toast({
          title: t("contact.error"),
          variant: "destructive",
        });
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-[80vh] py-16">
      <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">{t("contact.title")}</h1>
        <div className="h-1 w-24 bg-primary mb-12"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs uppercase font-bold tracking-wider">{t("contact.name")}</Label>
                  <Input id="name" name="name" required value={formData.name} onChange={handleChange} className="h-12 bg-zinc-50 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase font-bold tracking-wider">{t("contact.email")}</Label>
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} className="h-12 bg-zinc-50 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs uppercase font-bold tracking-wider">{t("contact.phone")}</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="h-12 bg-zinc-50 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-xs uppercase font-bold tracking-wider">{t("contact.subject")}</Label>
                <Input id="subject" name="subject" required value={formData.subject} onChange={handleChange} className="h-12 bg-zinc-50 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-xs uppercase font-bold tracking-wider">{t("contact.message")}</Label>
                <Textarea id="message" name="message" required value={formData.message} onChange={handleChange} className="min-h-[150px] bg-zinc-50 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary resize-y" />
              </div>
              <Button type="submit" disabled={contactMutation.isPending} className="w-full h-14 text-lg font-bold uppercase tracking-wider rounded-none">
                {contactMutation.isPending ? "..." : <><Send className="mr-2 h-5 w-5" /> {t("contact.send")}</>}
              </Button>
            </form>
          </div>
          
          {/* Contact Info & Map */}
          <div className="flex flex-col h-full space-y-10">
            <div>
              <h3 className="text-2xl font-black uppercase mb-6">{t("contact.info")}</h3>
              <div className="space-y-6">
                {address && (
                  <div className="flex items-start">
                    <MapPin className="h-6 w-6 text-primary mr-4 mt-1 shrink-0" />
                    <p className="text-lg whitespace-pre-line">{address}</p>
                  </div>
                )}
                {settings?.phone && (
                  <div className="flex items-center">
                    <Phone className="h-6 w-6 text-primary mr-4 shrink-0" />
                    <p className="text-lg">{settings.phone}</p>
                  </div>
                )}
                {settings?.email && (
                  <div className="flex items-center">
                    <Mail className="h-6 w-6 text-primary mr-4 shrink-0" />
                    <p className="text-lg">{settings.email}</p>
                  </div>
                )}
              </div>
            </div>
            
            {settings?.google_maps_embed && (
              <div className="flex-1 w-full min-h-[300px] bg-zinc-100 dark:bg-zinc-900 overflow-hidden" 
                   dangerouslySetInnerHTML={{ __html: settings.google_maps_embed }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
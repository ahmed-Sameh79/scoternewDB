import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Globe, MessageSquare, Mail, Phone, Save } from "lucide-react";
import { useTranslation } from "react-i18next";

type SiteSettings = Record<string, string>;

type ContactSubmission = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean | null;
  created_at: string | null;
};

function SettingField({
  label, settingKey, value, type = "text", onChange, multiline = false,
}: {
  label: string; settingKey: string; value: string; type?: string; onChange: (key: string, val: string) => void; multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(settingKey, e.target.value)} rows={3} className="text-sm" dir={settingKey.endsWith("_ar") ? "rtl" : undefined} />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(settingKey, e.target.value)} className="text-sm" dir={settingKey.endsWith("_ar") ? "rtl" : undefined} />
      )}
    </div>
  );
}

export default function WebsiteCMSPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const qc = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactSubmission | null>(null);
  const [localSettings, setLocalSettings] = useState<SiteSettings | null>(null);

  const { data: settingsRows, isLoading: settingsLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("key, value");
      if (error) throw new Error(error.message);
      const obj: SiteSettings = {};
      for (const row of data ?? []) { obj[row.key] = row.value ?? ""; }
      return obj;
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<ContactSubmission[]>({
    queryKey: ["contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: SiteSettings) => {
      const upserts = Object.entries(updates).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from("site_settings").upsert(upserts, { onConflict: "key" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success(isRtl ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
    },
    onError: () => toast.error(isRtl ? "فشل حفظ الإعدادات" : "Failed to save settings"),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("contact_submissions").update({ is_read: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-submissions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-submissions"] });
      setSelectedMessage(null);
      toast.success(isRtl ? "تم حذف الرسالة" : "Message deleted");
    },
  });

  const current = localSettings ?? settingsRows ?? {};
  const handleChange = (key: string, val: string) => setLocalSettings(prev => ({ ...(prev ?? current), [key]: val }));
  const handleSave = () => { if (localSettings) saveMutation.mutate(localSettings); };
  const handleView = (msg: ContactSubmission) => {
    setSelectedMessage(msg);
    if (!msg.is_read) markReadMutation.mutate(msg.id);
  };
  const unreadCount = submissions?.filter(s => !s.is_read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-orange-500" />
            {isRtl ? "إدارة الموقع الإلكتروني" : "Website Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRtl ? "تحكم في محتوى الموقع العام ورسائل العملاء" : "Control public website content and customer messages"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Globe className="h-4 w-4 mr-2" />{isRtl ? "إعدادات الموقع" : "Site Settings"}</TabsTrigger>
          <TabsTrigger value="messages" className="relative">
            <MessageSquare className="h-4 w-4 mr-2" />
            {isRtl ? "رسائل العملاء" : "Contact Messages"}
            {unreadCount > 0 && <Badge className="ml-2 h-5 px-1.5 text-[10px] bg-orange-500 text-white">{unreadCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-4">
          {settingsLoading ? (
            <div className="space-y-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">{isRtl ? "قسم الترحيب (Hero)" : "Hero Section"}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingField label={isRtl ? "العنوان (عربي)" : "Title (Arabic)"} settingKey="hero_title_ar" value={current.hero_title_ar ?? ""} onChange={handleChange} />
                  <SettingField label={isRtl ? "العنوان (إنجليزي)" : "Title (English)"} settingKey="hero_title" value={current.hero_title ?? ""} onChange={handleChange} />
                  <SettingField label={isRtl ? "الوصف (عربي)" : "Subtitle (Arabic)"} settingKey="hero_subtitle_ar" value={current.hero_subtitle_ar ?? ""} onChange={handleChange} multiline />
                  <SettingField label={isRtl ? "الوصف (إنجليزي)" : "Subtitle (English)"} settingKey="hero_subtitle" value={current.hero_subtitle ?? ""} onChange={handleChange} multiline />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">{isRtl ? "معلومات التواصل" : "Contact Information"}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingField label={isRtl ? "اسم الموقع" : "Site Name"} settingKey="site_name" value={current.site_name ?? ""} onChange={handleChange} />
                  <SettingField label={isRtl ? "البريد الإلكتروني" : "Email"} settingKey="contact_email" value={current.contact_email ?? ""} onChange={handleChange} type="email" />
                  <SettingField label={isRtl ? "رقم الهاتف" : "Phone"} settingKey="contact_phone" value={current.contact_phone ?? ""} onChange={handleChange} />
                  <SettingField label={isRtl ? "العنوان" : "Address"} settingKey="contact_address" value={current.contact_address ?? ""} onChange={handleChange} />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-orange-500 hover:bg-orange-600 gap-2">
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ الإعدادات" : "Save Settings")}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">{isRtl ? "الرسائل الواردة" : "Incoming Messages"}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {submissionsLoading ? (
                  <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : !submissions?.length ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? "لا توجد رسائل بعد" : "No messages yet"}</div>
                ) : (
                  <div className="divide-y">
                    {submissions.map(msg => (
                      <button key={msg.id} onClick={() => handleView(msg)} className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedMessage?.id === msg.id ? "bg-orange-50" : ""}`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-medium text-sm ${!msg.is_read ? "text-orange-700" : ""}`}>{msg.name}</span>
                          {!msg.is_read && <Badge className="h-2 w-2 p-0 rounded-full bg-orange-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.subject || msg.message.slice(0, 50)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ""}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              {selectedMessage ? (
                <>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedMessage.name}</CardTitle>
                      {selectedMessage.subject && <CardDescription className="mt-0.5">{selectedMessage.subject}</CardDescription>}
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 h-8 w-8"
                      onClick={() => { if (confirm(isRtl ? "حذف الرسالة؟" : "Delete message?")) deleteMutation.mutate(selectedMessage.id); }}>
                      <span className="text-xs">✕</span>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {selectedMessage.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedMessage.email}</span>}
                      {selectedMessage.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedMessage.phone}</span>}
                      <span>{selectedMessage.created_at ? new Date(selectedMessage.created_at).toLocaleString() : ""}</span>
                    </div>
                    <Separator />
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedMessage.message}</p>
                    {selectedMessage.email && (
                      <Button variant="outline" size="sm" className="gap-1" asChild>
                        <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject || ""}`}>
                          <Mail className="h-3 w-3" />{isRtl ? "رد بالبريد" : "Reply via Email"}
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  {isRtl ? "اختر رسالة لعرضها" : "Select a message to view"}
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

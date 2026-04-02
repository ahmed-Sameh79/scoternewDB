import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bike, Loader2, Languages } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isRtl = i18n.language === "ar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success(t("login.loginSuccess"));
      setLocation("/");
    } catch (error) {
      toast.error((error as Error).message || t("login.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md space-y-3">
        <div className={`flex justify-end ${isRtl ? "flex-row-reverse justify-start" : ""}`}>
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-1.5 text-xs">
            <Languages className="h-3.5 w-3.5 text-orange-500" />
            {i18n.language === "ar" ? "English" : "عربي"}
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-500 p-3 rounded-full">
                <Bike className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-orange-600">{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@motoshop.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("login.password")}</label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </span>
                ) : (
                  t("login.loginButton")
                )}
              </Button>
              <div className="mt-4 rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800 space-y-1">
                <p className="font-semibold">Demo accounts:</p>
                <p>admin@motoshop.com / Admin1234!</p>
                <p>ali@motoshop.com / Store1234!</p>
                <p>rahman@motoshop.com / Tech1234!</p>
                <p>siti@motoshop.com / Sales1234!</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

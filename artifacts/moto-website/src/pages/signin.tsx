import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogin } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SignIn() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password }, {
      onSuccess: () => {
        toast({
          title: t("signin.success"),
          variant: "default",
        });
        window.location.href = "/admin/";
      },
      onError: () => {
        toast({
          title: t("signin.error"),
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden rounded-none">
        <div className="bg-primary p-6 text-primary-foreground flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest">{t("signin.title")}</h1>
        </div>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t("signin.username")}</Label>
              <Input 
                id="username" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="h-14 text-lg bg-zinc-100 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t("signin.password")}</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="h-14 text-lg bg-zinc-100 dark:bg-zinc-900 border-none rounded-none focus-visible:ring-primary"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loginMutation.isPending} 
              className="w-full h-14 text-lg font-bold uppercase tracking-wider rounded-none mt-4"
            >
              {loginMutation.isPending ? "..." : t("signin.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
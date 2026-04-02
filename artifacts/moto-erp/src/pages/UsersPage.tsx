import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Edit, ShieldCheck, ShieldAlert, Info } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["admin", "storekeeper", "technician", "sales"]),
  is_active: z.boolean().default(true),
});

export default function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["/users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", full_name: "", role: "sales", is_active: true },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof userSchema>) => {
      const { error } = await supabase.from("profiles").update(values).eq("id", editingUser.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/users"] });
      toast.success("User updated");
      setIsEditOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (user: any) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setIsEditOpen(true);
  };

  function roleBadge(role: string) {
    const map: Record<string, string> = {
      admin: "bg-red-100 text-red-700",
      storekeeper: "bg-blue-100 text-blue-700",
      technician: "bg-yellow-100 text-yellow-700",
      sales: "bg-green-100 text-green-700",
    };
    return <Badge className={`${map[role] ?? "bg-gray-100 text-gray-700"} capitalize`}>{role}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="text-muted-foreground">{t("users.administerSubtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0" />
        <span>To create new users, go to your Supabase Dashboard → Authentication → Users and invite them. Set their role via <strong>User Metadata</strong>.</span>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.fullName")}</TableHead>
              <TableHead>{t("users.username")}</TableHead>
              <TableHead>{t("users.email")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("users.status")}</TableHead>
              <TableHead>{t("common.createdAt")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.full_name}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">@{user.username}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell>
                  {user.is_active
                    ? <div className="flex items-center gap-1 text-green-600"><ShieldCheck className="h-4 w-4" /> Active</div>
                    : <div className="flex items-center gap-1 text-red-500"><ShieldAlert className="h-4 w-4" /> Inactive</div>
                  }
                </TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={(o) => { if (!o) { setIsEditOpen(false); setEditingUser(null); form.reset(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.editUser")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => updateMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>{t("users.fullName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem><FormLabel>{t("users.username")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>{t("users.role")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="storekeeper">Storekeeper</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {t("users.updateUser")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

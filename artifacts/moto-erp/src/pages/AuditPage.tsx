import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

export default function AuditPage() {
  const { t } = useTranslation();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["/audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(username, full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  function actionBadge(action: string) {
    const map: Record<string, string> = {
      create: "bg-green-100 text-green-700",
      update: "bg-blue-100 text-blue-700",
      delete: "bg-red-100 text-red-700",
    };
    return (
      <Badge className={`${map[action] ?? "bg-gray-100 text-gray-700"} capitalize`}>
        {action}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("audit.title")}</h1>
        <p className="text-muted-foreground">{t("audit.subtitle")}</p>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("audit.timestamp")}</TableHead>
              <TableHead>{t("audit.user")}</TableHead>
              <TableHead>{t("audit.action")}</TableHead>
              <TableHead>{t("audit.entity")}</TableHead>
              <TableHead>{t("audit.entityId")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(8)].map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
              : logs?.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                  <TableCell className="font-medium">
                    {(log as any).profiles?.username ?? log.user_id?.slice(0, 8) ?? "—"}
                  </TableCell>
                  <TableCell>{actionBadge(log.action)}</TableCell>
                  <TableCell className="font-mono text-sm">{log.entity}</TableCell>
                  <TableCell className="text-muted-foreground">{log.entity_id ?? "—"}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, PieChart, Pie, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, Wrench, Package, Bike, ShoppingCart, AlertTriangle, Clock,
  TrendingUp, TrendingDown, BarChart2,
} from "lucide-react";
import { subDays, format, parseISO, startOfDay } from "date-fns";

export default function DashboardPage() {
  const { t } = useTranslation();

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["/analytics/dashboard"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const [
        { data: paidInvoices },
        { data: allParts },
        { data: allMotorcycles },
        { data: allPOs },
        { data: activeWOs },
        { data: staleWOs },
        { data: invoiceLinesParts },
      ] = await Promise.all([
        supabase.from("invoices").select("total_amount, subtotal, tax_amount, created_at").eq("status", "paid"),
        supabase.from("parts").select("id, name, quantity_on_hand, reorder_point"),
        supabase.from("motorcycles").select("id, status"),
        supabase.from("purchase_orders").select("id, status"),
        supabase.from("work_orders").select("id, status").in("status", ["pending", "in_progress", "parts_reserved", "draft"]),
        supabase.from("work_orders").select("id, wo_number, customer_name, status, updated_at")
          .in("status", ["pending", "in_progress", "parts_reserved"])
          .lt("updated_at", subDays(new Date(), 3).toISOString())
          .limit(5),
        supabase.from("invoice_lines").select("part_id, quantity, parts(name)").not("part_id", "is", null),
      ]);

      const totalRevenue = (paidInvoices ?? []).reduce((s, inv) => s + parseFloat(inv.total_amount), 0);
      const subtotal = (paidInvoices ?? []).reduce((s, inv) => s + parseFloat(inv.subtotal), 0);
      const totalTax = (paidInvoices ?? []).reduce((s, inv) => s + parseFloat(inv.tax_amount), 0);

      const lowStockParts = (allParts ?? []).filter(p => p.quantity_on_hand <= p.reorder_point);
      const availableMotorcycles = (allMotorcycles ?? []).filter(m => m.status === "available").length;
      const pendingPOs = (allPOs ?? []).filter(po => ["draft", "ordered"].includes(po.status)).length;

      const partSales: Record<string, { name: string; qty: number }> = {};
      for (const line of invoiceLinesParts ?? []) {
        const pid = String(line.part_id);
        if (!partSales[pid]) partSales[pid] = { name: (line as any).parts?.name ?? "Unknown", qty: 0 };
        partSales[pid].qty += line.quantity;
      }
      const topParts = Object.entries(partSales)
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 5)
        .map(([partId, info]) => ({ partId: parseInt(partId), name: info.name, totalQty: info.qty }));

      return {
        totalRevenue,
        subtotal,
        totalTax,
        grossProfit: subtotal - totalTax,
        netProfit: totalRevenue - totalTax,
        netRevenue: subtotal,
        pendingWorkOrders: (activeWOs ?? []).length,
        lowStockPartsCount: lowStockParts.length,
        availableMotorcycles,
        pendingPurchaseOrders: pendingPOs,
        lowStockParts: lowStockParts.slice(0, 5).map(p => ({ id: p.id, name: p.name, quantityOnHand: p.quantity_on_hand, reorderPoint: p.reorder_point })),
        staleWorkOrders: (staleWOs ?? []).map(wo => ({ id: wo.id, woNumber: wo.wo_number, customerName: wo.customer_name, status: wo.status })),
        topParts,
        motorcycleStatuses: allMotorcycles ?? [],
        workOrderStatuses: activeWOs ?? [],
        invoicesByDay: paidInvoices ?? [],
      };
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["/analytics/sales"],
    queryFn: async () => {
      const days: { date: string; revenue: number }[] = [];
      const byDay: Record<string, number> = {};
      const inv = summary?.invoicesByDay ?? [];
      for (const invoice of inv) {
        const day = format(parseISO(invoice.created_at), "yyyy-MM-dd");
        byDay[day] = (byDay[day] ?? 0) + parseFloat(invoice.total_amount);
      }
      for (let i = 29; i >= 0; i--) {
        const day = format(subDays(new Date(), i), "yyyy-MM-dd");
        days.push({ date: format(subDays(new Date(), i), "dd MMM"), revenue: byDay[day] ?? 0 });
      }
      return days;
    },
    enabled: !!summary,
  });

  const COLORS = ["#F97316", "#3B82F6", "#10B981", "#6366F1", "#EF4444"];

  if (isSummaryLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const kpis = [
    { label: t("dashboard.totalRevenue"), value: formatCurrency(summary?.totalRevenue ?? 0), icon: DollarSign, color: "text-green-600" },
    { label: t("dashboard.activeWorkOrders"), value: summary?.pendingWorkOrders ?? 0, icon: Wrench, color: "text-blue-600" },
    { label: t("dashboard.lowStockParts"), value: summary?.lowStockPartsCount ?? 0, icon: Package, color: "text-red-600" },
    { label: t("nav.motorcycles"), value: summary?.availableMotorcycles ?? 0, icon: Bike, color: "text-orange-600" },
    { label: t("dashboard.pendingPos"), value: summary?.pendingPurchaseOrders ?? 0, icon: ShoppingCart, color: "text-purple-600" },
  ];

  const grossMarginPct = summary && summary.subtotal > 0
    ? ((summary.grossProfit / summary.subtotal) * 100).toFixed(1)
    : "0.0";

  const plCards = [
    { label: t("dashboard.totalRevenuePnl"), value: formatCurrency(summary?.totalRevenue ?? 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: t("dashboard.subtotal"), value: formatCurrency(summary?.subtotal ?? 0), icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t("dashboard.totalTax"), value: formatCurrency(summary?.totalTax ?? 0), icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
    { label: `${t("dashboard.grossMargin")} (${grossMarginPct}%)`, value: formatCurrency(summary?.grossProfit ?? 0), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  const motorcycleStatusData = [
    { name: "Available", value: (summary?.motorcycleStatuses ?? []).filter((m: any) => m.status === "available").length },
    { name: "Sold", value: (summary?.motorcycleStatuses ?? []).filter((m: any) => m.status === "sold").length },
    { name: "In Service", value: (summary?.motorcycleStatuses ?? []).filter((m: any) => m.status === "in_service").length },
    { name: "Pre-Owned", value: (summary?.motorcycleStatuses ?? []).filter((m: any) => m.status === "pre_owned").length },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {plCards.map((c, i) => (
          <Card key={i} className={c.bg}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("dashboard.salesLast30Days")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={salesData ?? []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val: any) => formatCurrency(val)} />
                <Area type="monotone" dataKey="revenue" stroke="#F97316" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("dashboard.inventoryStatus")}</CardTitle></CardHeader>
          <CardContent>
            {motorcycleStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={motorcycleStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {motorcycleStatusData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                No motorcycle data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base">{t("dashboard.lowStockAlerts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(summary?.lowStockParts?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("dashboard.noLowStock")}</p>
            ) : (
              <ul className="space-y-2">
                {summary?.lowStockParts?.map(p => (
                  <li key={p.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium truncate max-w-[160px]">{p.name}</span>
                    <Badge variant="destructive">{p.quantityOnHand}/{p.reorderPoint}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-base">{t("dashboard.staleWorkOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(summary?.staleWorkOrders?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("dashboard.noStaleWo")}</p>
            ) : (
              <ul className="space-y-2">
                {summary?.staleWorkOrders?.map(wo => (
                  <li key={wo.id} className="flex justify-between items-center text-sm">
                    <span>
                      <span className="font-mono font-medium">{wo.woNumber}</span>
                      <span className="text-muted-foreground ml-1">{wo.customerName}</span>
                    </span>
                    <Badge variant="outline">{wo.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("dashboard.topParts")}</CardTitle></CardHeader>
          <CardContent>
            {(summary?.topParts?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales data yet</p>
            ) : (
              <ul className="space-y-2">
                {summary?.topParts?.map((p, idx) => (
                  <li key={p.partId ?? idx} className="flex justify-between items-center text-sm">
                    <span className="font-medium truncate max-w-[160px]">{p.name ?? "Unknown"}</span>
                    <span className="text-muted-foreground">{p.totalQty} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

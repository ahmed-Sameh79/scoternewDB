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
  Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wrench, Eye, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["parts_reserved", "cancelled"],
  parts_reserved: ["completed", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending", in_progress: "In Progress",
  parts_reserved: "Parts Reserved", completed: "Completed", cancelled: "Cancelled",
};

const woSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  motorcycleId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  assignedTo: z.string().optional(),
  laborCost: z.number().min(0),
  lines: z.array(z.object({
    partId: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    binId: z.string().optional(),
  })).optional(),
});

type WOFormValues = z.infer<typeof woSchema>;

export default function WorkOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedWOId, setSelectedWOId] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: wos } = useQuery({
    queryKey: ["/work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, motorcycles(make, model, vin), profiles!work_orders_assigned_to_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((wo: any) => ({
        ...wo,
        woNumber: wo.wo_number,
        customerName: wo.customer_name,
        customerPhone: wo.customer_phone,
        motorcycleName: wo.motorcycles ? `${wo.motorcycles.make} ${wo.motorcycles.model}` : null,
        assignedToName: wo.profiles?.full_name ?? null,
        laborCost: wo.labor_cost,
        totalPartsCost: wo.total_parts_cost,
        createdAt: wo.created_at,
        updatedAt: wo.updated_at,
      }));
    },
  });

  const { data: selectedWO } = useQuery({
    queryKey: ["/work-orders", selectedWOId],
    queryFn: async () => {
      const { data: wo, error: woErr } = await supabase
        .from("work_orders")
        .select("*, motorcycles(make, model, vin), profiles!work_orders_assigned_to_fkey(full_name)")
        .eq("id", selectedWOId!)
        .single();
      if (woErr) throw new Error(woErr.message);

      const { data: lines, error: linesErr } = await supabase
        .from("work_order_parts")
        .select("*, parts(name, sku), bins(label)")
        .eq("work_order_id", selectedWOId!);
      if (linesErr) throw new Error(linesErr.message);

      return {
        ...wo,
        woNumber: wo.wo_number,
        customerName: wo.customer_name,
        customerPhone: wo.customer_phone,
        motorcycleName: wo.motorcycles ? `${wo.motorcycles.make} ${wo.motorcycles.model}` : null,
        assignedToName: wo.profiles?.full_name ?? null,
        laborCost: wo.labor_cost,
        totalPartsCost: wo.total_parts_cost,
        createdAt: wo.created_at,
        updatedAt: wo.updated_at,
        lines: (lines ?? []).map((l: any) => ({
          ...l,
          partName: l.parts?.name,
          partSku: l.parts?.sku,
          binLabel: l.bins?.label ?? null,
          unitPrice: l.unit_price,
          totalPrice: l.total_price,
        })),
      };
    },
    enabled: !!selectedWOId,
  });

  const { data: technicians } = useQuery({
    queryKey: ["/technicians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "technician").order("full_name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: motorcycles } = useQuery({
    queryKey: ["/motorcycles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles").select("id, make, model, vin").order("make");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["/parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("id, name, quantity_on_hand").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: bins } = useQuery({
    queryKey: ["/bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bins").select("id, label").order("label");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<WOFormValues>({
    resolver: zodResolver(woSchema),
    defaultValues: { customerName: "", customerPhone: "", description: "", assignedTo: "", laborCost: 0, lines: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const createMutation = useMutation({
    mutationFn: async (values: WOFormValues) => {
      const { data: woNum, error: seqErr } = await supabase.rpc("next_document_number", { p_prefix: "WO" });
      if (seqErr) throw new Error(seqErr.message);

      const totalPartsCost = (values.lines ?? []).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const { data: wo, error: woErr } = await supabase
        .from("work_orders")
        .insert({
          wo_number: woNum,
          customer_name: values.customerName,
          customer_phone: values.customerPhone,
          motorcycle_id: values.motorcycleId && values.motorcycleId !== "none" ? parseInt(values.motorcycleId) : null,
          description: values.description,
          assigned_to: values.assignedTo && values.assignedTo !== "none" ? values.assignedTo : null,
          labor_cost: values.laborCost,
          total_parts_cost: totalPartsCost,
          status: "draft",
        })
        .select()
        .single();
      if (woErr) throw new Error(woErr.message);

      if (values.lines && values.lines.length > 0) {
        const lineRows = values.lines.map(l => ({
          work_order_id: wo.id,
          part_id: parseInt(l.partId),
          quantity: l.quantity,
          unit_price: l.unitPrice,
          total_price: l.quantity * l.unitPrice,
          bin_id: l.binId && l.binId !== "none" ? parseInt(l.binId) : null,
        }));
        const { error: linesErr } = await supabase.from("work_order_parts").insert(lineRows);
        if (linesErr) throw new Error(linesErr.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/work-orders"] });
      toast.success("Work Order created");
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create work order"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { error } = await supabase.from("work_orders").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/work-orders"] });
      if (selectedWOId) queryClient.invalidateQueries({ queryKey: ["/work-orders", selectedWOId] });
      toast.success("Status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700 border",
      pending: "bg-yellow-100 text-yellow-700 border",
      in_progress: "bg-blue-500 text-white",
      parts_reserved: "bg-purple-500 text-white",
      completed: "bg-green-500 text-white",
      cancelled: "bg-red-500 text-white",
    };
    return <Badge className={variants[status] ?? ""}>{STATUS_LABELS[status] ?? status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("workOrders.title")}</h1>
          <p className="text-muted-foreground">{t("workOrders.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("workOrders.createWO")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader><DialogTitle>{t("workOrders.createWorkOrder")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem><FormLabel>{t("workOrders.customerName")}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem><FormLabel>{t("workOrders.customerPhone")}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="motorcycleId" render={({ field }) => (
                  <FormItem><FormLabel>{t("workOrders.motorcycleLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("workOrders.motorcycle")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {motorcycles?.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.make} {m.model} ({m.vin ?? "no VIN"})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>{t("workOrders.issueDescription")}</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="assignedTo" render={({ field }) => (
                    <FormItem><FormLabel>{t("workOrders.assignTechnician")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("workOrders.technician")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {technicians?.map((tech: any) => <SelectItem key={tech.id} value={tech.id}>{tech.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="laborCost" render={({ field }) => (
                    <FormItem><FormLabel>{t("workOrders.laborCost")}</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="space-y-2">
                  <FormLabel>{t("workOrders.requiredParts")}</FormLabel>
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-2 rounded">
                      <div className="col-span-5">
                        <FormField control={form.control} name={`lines.${index}.partId`} render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Part" /></SelectTrigger></FormControl>
                              <SelectContent>{parts?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name} (Qty: {p.quantity_on_hand})</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`lines.${index}.quantity`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" placeholder={t("invoices.qty")} {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`lines.${index}.unitPrice`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" step="0.01" placeholder={t("common.price")} {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`lines.${index}.binId`} render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder={t("parts.bin")} /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">{t("workOrders.noBin")}</SelectItem>
                                {bins?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ partId: "", quantity: 1, unitPrice: 0, binId: "" })}>Add Part</Button>
                </div>
                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("workOrders.creating") : t("workOrders.createWorkOrder")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("workOrders.woNumber")}</TableHead>
              <TableHead>{t("workOrders.customer")}</TableHead>
              <TableHead>{t("workOrders.motorcycle")}</TableHead>
              <TableHead>{t("workOrders.technician")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("workOrders.laborCost")}</TableHead>
              <TableHead>{t("workOrders.dateCol")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wos?.map((wo: any) => {
              const isStale = wo.status !== "completed" && wo.status !== "cancelled" && differenceInDays(new Date(), new Date(wo.updatedAt)) >= 7;
              const nextStatuses = VALID_TRANSITIONS[wo.status] ?? [];
              return (
                <TableRow key={wo.id}>
                  <TableCell className="font-mono font-medium">
                    {wo.woNumber}
                    {isStale && <Badge variant="destructive" className="ml-2 text-[10px]">STALE</Badge>}
                  </TableCell>
                  <TableCell>
                    <div>{wo.customerName}</div>
                    <div className="text-xs text-muted-foreground">{wo.customerPhone}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{wo.motorcycleName ?? "—"}</TableCell>
                  <TableCell>{wo.assignedToName ?? "—"}</TableCell>
                  <TableCell>{getStatusBadge(wo.status)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(parseFloat(wo.laborCost ?? "0"))}</TableCell>
                  <TableCell>{formatDate(wo.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {nextStatuses.length > 0 && (
                        <Select onValueChange={(status) => updateStatusMutation.mutate({ id: wo.id, status })}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder={t("workOrders.changeStatus")} />
                          </SelectTrigger>
                          <SelectContent>
                            {nextStatuses.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setSelectedWOId(wo.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!wos?.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("workOrders.noWorkOrders")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedWOId && (
        <Dialog open={!!selectedWOId} onOpenChange={() => setSelectedWOId(null)}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />{t("workOrders.woTitle")}: {selectedWO?.woNumber ?? t("common.loading")}
              </DialogTitle>
            </DialogHeader>
            {!selectedWO ? (
              <div className="py-8 text-center text-muted-foreground">{t("workOrders.loadingDetails")}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(selectedWO.status)}</div>
                  <div><span className="text-muted-foreground">Technician:</span> {selectedWO.assignedToName ?? t("workOrders.unassigned")}</div>
                  <div><span className="text-muted-foreground">Customer:</span> {selectedWO.customerName}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedWO.customerPhone}</div>
                  {selectedWO.motorcycleName && <div className="col-span-2"><span className="text-muted-foreground">Motorcycle:</span> {selectedWO.motorcycleName}</div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {selectedWO.description}</div>
                  <div><span className="text-muted-foreground">Labor Cost:</span> {formatCurrency(parseFloat(selectedWO.laborCost ?? "0"))}</div>
                  <div><span className="text-muted-foreground">Parts Cost:</span> {formatCurrency(parseFloat(selectedWO.totalPartsCost ?? "0"))}</div>
                  <div><span className="text-muted-foreground">Created:</span> {formatDate(selectedWO.createdAt)}</div>
                  <div><span className="text-muted-foreground">Last Updated:</span> {formatDate(selectedWO.updatedAt)}</div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">{t("workOrders.reservedParts")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("workOrders.partName")}</TableHead>
                        <TableHead>{t("workOrders.skuCol")}</TableHead>
                        <TableHead>{t("workOrders.binLocation")}</TableHead>
                        <TableHead className="text-right">{t("invoices.qty")}</TableHead>
                        <TableHead className="text-right">{t("invoices.unitPrice")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedWO.lines?.length ? selectedWO.lines.map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.partName}</TableCell>
                          <TableCell className="font-mono text-xs">{line.partSku}</TableCell>
                          <TableCell>
                            {line.binLabel ? <Badge variant="outline" className="text-xs">{line.binLabel}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(line.unitPrice ?? "0"))}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(parseFloat(line.totalPrice ?? "0"))}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("workOrders.noPartsReserved")}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-sm font-semibold">
                    {t("common.total")}: {formatCurrency(parseFloat(selectedWO.laborCost ?? "0") + parseFloat(selectedWO.totalPartsCost ?? "0"))}
                  </div>
                  <div className="flex gap-2">
                    {(VALID_TRANSITIONS[selectedWO.status] ?? []).map(nextStatus => (
                      <Button key={nextStatus} variant={nextStatus === "cancelled" ? "destructive" : "outline"} size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: selectedWO.id, status: nextStatus })}
                        disabled={updateStatusMutation.isPending}>
                        → {STATUS_LABELS[nextStatus]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

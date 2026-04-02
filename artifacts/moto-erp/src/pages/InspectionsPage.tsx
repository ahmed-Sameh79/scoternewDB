import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle2, XCircle, Download, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

type ConditionGrade = "excellent" | "good" | "fair" | "poor";
const CONDITION_OPTIONS: ConditionGrade[] = ["excellent", "good", "fair", "poor"];

const inspectionSchema = z.object({
  motorcycle_id: z.string().min(1, "Motorcycle is required"),
  overall_grade: z.enum(["excellent", "good", "fair", "poor"]),
  engine_condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  body_condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  electrical_condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  tires_condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  brake_condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  notes: z.string().optional(),
  is_certified: z.boolean().default(false),
});

const CONDITION_FIELDS: { name: keyof z.infer<typeof inspectionSchema>; label: string }[] = [
  { name: "overall_grade", label: "Overall Grade" },
  { name: "engine_condition", label: "Engine" },
  { name: "body_condition", label: "Body / Frame" },
  { name: "electrical_condition", label: "Electrical" },
  { name: "tires_condition", label: "Tires" },
  { name: "brake_condition", label: "Brakes" },
];

function generateInspectionPdf(insp: any): void {
  import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFontSize(22); doc.setTextColor(249, 115, 22); doc.text("Inspection Report", 20, y);
    doc.setTextColor(0, 0, 0); y += 8;
    doc.setFontSize(11); doc.text(`${insp.motorcycles?.year} ${insp.motorcycles?.make} ${insp.motorcycles?.model}`, 20, y); y += 6;
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`VIN: ${insp.motorcycles?.vin ?? "-"}`, 20, y); doc.setTextColor(0, 0, 0); y += 10;
    doc.text(`Inspector: ${insp.profiles?.full_name ?? "—"}`, 20, y);
    doc.text(`Date: ${formatDate(insp.created_at)}`, pageW - 20, y, { align: "right" }); y += 6;
    doc.text(`Overall Grade: ${insp.overall_grade.toUpperCase()}`, 20, y);
    doc.text(`Certified: ${insp.is_certified ? "YES" : "NO"}`, pageW - 20, y, { align: "right" }); y += 12;
    const rows: [string, string][] = [
      ["Engine", insp.engine_condition], ["Body / Frame", insp.body_condition],
      ["Electrical", insp.electrical_condition], ["Tires", insp.tires_condition], ["Brakes", insp.brake_condition],
    ].filter(([, v]) => v) as [string, string][];
    doc.setFont("helvetica", "bold"); doc.text("Condition Summary", 20, y); doc.setFont("helvetica", "normal"); y += 6;
    for (const [label, val] of rows) {
      doc.setFontSize(10); doc.text(label, 20, y); doc.text(val.charAt(0).toUpperCase() + val.slice(1), pageW - 20, y, { align: "right" }); y += 6;
    }
    if (insp.notes) {
      y += 4; doc.setFont("helvetica", "bold"); doc.text("Notes", 20, y); doc.setFont("helvetica", "normal"); y += 5;
      doc.setFontSize(9); const lines = doc.splitTextToSize(insp.notes, pageW - 40); doc.text(lines, 20, y);
    }
    doc.save(`inspection-${insp.id}.pdf`);
  }).catch(() => toast.error("PDF generation failed — try again"));
}

export default function InspectionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  const { data: inspections } = useQuery({
    queryKey: ["/inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, motorcycles(year, make, model, vin), profiles(full_name)")
        .order("created_at", { ascending: false });
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

  const form = useForm<z.infer<typeof inspectionSchema>>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: { motorcycle_id: "", overall_grade: "good", notes: "", is_certified: false },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inspectionSchema>) => {
      const { error } = await supabase.from("inspections").insert({
        ...values,
        motorcycle_id: parseInt(values.motorcycle_id),
        inspector_id: user?.id ?? null,
        image_urls: [],
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/inspections"] });
      toast.success("Inspection report saved");
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to save inspection"),
  });

  const getGradeBadge = (grade: string) => {
    const map: Record<string, string> = {
      excellent: "bg-green-600 text-white", good: "bg-blue-600 text-white",
      fair: "bg-yellow-600 text-white", poor: "bg-red-600 text-white",
    };
    return <Badge className={map[grade] ?? ""}>{grade}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("inspections.title")}</h1>
          <p className="text-muted-foreground">{t("inspections.preOwnedSubtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("inspections.newInspection")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{t("inspections.recordInspection")}</DialogTitle>
              <DialogDescription>{t("inspections.formDescription")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="motorcycle_id" render={({ field }) => (
                  <FormItem><FormLabel>{t("inspections.motorcycle")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("inspections.selectMotorcycle")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {motorcycles?.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.make} {m.model} ({m.vin ?? "no VIN"})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  {CONDITION_FIELDS.map(({ name, label }) => (
                    <Controller
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem><FormLabel>{label}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value as string | undefined}>
                            <FormControl><SelectTrigger><SelectValue placeholder={t("inspections.selectGrade")} /></SelectTrigger></FormControl>
                            <SelectContent>
                              {CONDITION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>{t("inspections.inspectionNotes")}</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                )} />

                <FormField control={form.control} name="is_certified" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <FormLabel>{t("inspections.certifiedLabel")}</FormLabel>
                    <FormControl>
                      <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600" />
                    </FormControl>
                  </FormItem>
                )} />

                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-orange-500 hover:bg-orange-600">
                  {createMutation.isPending ? t("inspections.saving") : t("inspections.saveInspection")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("inspections.motorcycle")}</TableHead>
              <TableHead>{t("inspections.vinCol")}</TableHead>
              <TableHead>{t("inspections.inspectorCol")}</TableHead>
              <TableHead>{t("inspections.gradeCol")}</TableHead>
              <TableHead>{t("inspections.certifiedCol")}</TableHead>
              <TableHead>{t("inspections.dateCol")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections?.map((insp: any) => (
              <TableRow key={insp.id}>
                <TableCell className="font-medium">{insp.motorcycles?.year} {insp.motorcycles?.make} {insp.motorcycles?.model}</TableCell>
                <TableCell className="font-mono text-xs">{insp.motorcycles?.vin ?? "—"}</TableCell>
                <TableCell>{insp.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{getGradeBadge(insp.overall_grade)}</TableCell>
                <TableCell>
                  {insp.is_certified
                    ? <div className="flex items-center gap-1 text-green-600 font-bold text-xs"><CheckCircle2 className="h-3 w-3" /> YES</div>
                    : <div className="flex items-center gap-1 text-muted-foreground text-xs"><XCircle className="h-3 w-3" /> NO</div>
                  }
                </TableCell>
                <TableCell>{formatDate(insp.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedInspection(insp)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!inspections?.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No inspections yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedInspection && (
        <Dialog open={!!selectedInspection} onOpenChange={() => setSelectedInspection(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Inspection Report</DialogTitle>
              <DialogDescription>Detailed inspection report</DialogDescription>
            </DialogHeader>
            <div id="inspection-report" className="space-y-4 p-2">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-orange-600">{t("inspections.inspectionReport")}</h2>
                  <p className="text-sm text-muted-foreground">{selectedInspection.motorcycles?.year} {selectedInspection.motorcycles?.make} {selectedInspection.motorcycles?.model}</p>
                  <p className="text-xs font-mono text-muted-foreground">VIN: {selectedInspection.motorcycles?.vin ?? "—"}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <QRCodeSVG value={JSON.stringify({ insp: selectedInspection.id, grade: selectedInspection.overall_grade, certified: selectedInspection.is_certified })} size={72} level="M" />
                  <span className="text-[10px] text-muted-foreground">Scan to verify</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm border-y py-3">
                <div><span className="text-muted-foreground">Inspector:</span> {selectedInspection.profiles?.full_name ?? "—"}</div>
                <div><span className="text-muted-foreground">Date:</span> {formatDate(selectedInspection.created_at)}</div>
                <div><span className="text-muted-foreground">Overall Grade:</span> {getGradeBadge(selectedInspection.overall_grade)}</div>
                <div><span className="text-muted-foreground">Certified:</span> {selectedInspection.is_certified ? <span className="text-green-600 font-bold">YES</span> : "NO"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {([
                  [t("inspections.engine"), selectedInspection.engine_condition],
                  [t("inspections.bodyFrame"), selectedInspection.body_condition],
                  [t("inspections.electrical"), selectedInspection.electrical_condition],
                  [t("inspections.tires"), selectedInspection.tires_condition],
                  [t("inspections.brakes"), selectedInspection.brake_condition],
                ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between border rounded p-2">
                    <span className="text-muted-foreground">{label}</span>
                    {getGradeBadge(val!)}
                  </div>
                ))}
              </div>
              {selectedInspection.notes && (
                <div className="border rounded p-3 text-sm">
                  <p className="font-medium mb-1">Notes</p>
                  <p className="text-muted-foreground">{selectedInspection.notes}</p>
                </div>
              )}
              <div className="flex justify-center pt-2">
                <Button onClick={() => generateInspectionPdf(selectedInspection)} className="gap-2 bg-orange-500 hover:bg-orange-600">
                  <Download className="h-4 w-4" /> {t("inspections.downloadReport")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

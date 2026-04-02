import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile };
      warehouses: { Row: Warehouse };
      bins: { Row: Bin };
      parts: { Row: Part };
      motorcycles: { Row: Motorcycle };
      vendors: { Row: Vendor };
      purchase_orders: { Row: PurchaseOrder };
      purchase_order_lines: { Row: PurchaseOrderLine };
      grn: { Row: Grn };
      grn_lines: { Row: GrnLine };
      work_orders: { Row: WorkOrder };
      work_order_parts: { Row: WorkOrderPart };
      invoices: { Row: Invoice };
      invoice_lines: { Row: InvoiceLine };
      returns: { Row: Return };
      inspections: { Row: Inspection };
      audit_logs: { Row: AuditLog };
      categories: { Row: Category };
      subcategories: { Row: Subcategory };
      motorcycle_categories: { Row: MotorcycleCategory };
      motorcycle_subcategories: { Row: MotorcycleSubcategory };
      motorcycle_brands: { Row: MotorcycleBrand };
      site_settings: { Row: SiteSetting };
      contact_submissions: { Row: ContactSubmission };
    };
  };
};

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "storekeeper" | "technician" | "sales";
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: number;
  name: string;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bin {
  id: number;
  warehouse_id: number;
  shelf_id: number | null;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  label: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MotorcycleCategory {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MotorcycleSubcategory {
  id: number;
  motorcycle_category_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MotorcycleBrand {
  id: number;
  motorcycle_category_id: number | null;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  condition: "new" | "used";
  model_compatibility: string | null;
  subcategory_id: number | null;
  quantity_on_hand: number;
  reorder_point: number;
  cost_price: string;
  selling_price: string;
  image_url: string | null;
  warehouse_id: number | null;
  bin_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Motorcycle {
  id: number;
  make: string;
  model: string;
  year: number;
  vin: string | null;
  color: string | null;
  engine_size: string | null;
  mileage: number | null;
  condition: "new" | "used";
  status: "available" | "sold" | "in_service" | "pre_owned";
  brand_id: number | null;
  motorcycle_subcategory_id: number | null;
  subcategory_id: number | null;
  cost_price: string;
  selling_price: string;
  image_url: string | null;
  engine_cc: number | null;
  top_speed: number | null;
  fuel_capacity: string | null;
  weight: number | null;
  seat_height: number | null;
  transmission: string | null;
  fuel_type: string | null;
  features: string | null;
  warehouse_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  notes: string | null;
  total_purchased: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  total_amount: string;
  notes: string | null;
  ordered_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  part_id: number;
  quantity: number;
  unit_cost: string;
  total_cost: string;
  created_at: string;
}

export interface Grn {
  id: number;
  grn_number: string;
  purchase_order_id: number;
  received_at: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface GrnLine {
  id: number;
  grn_id: number;
  part_id: number;
  quantity_received: number;
  bin_id: number | null;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  wo_number: string;
  customer_name: string;
  customer_phone: string | null;
  motorcycle_id: number | null;
  description: string;
  status: "draft" | "pending" | "in_progress" | "parts_reserved" | "completed" | "cancelled";
  assigned_to: string | null;
  labor_cost: string;
  total_parts_cost: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderPart {
  id: number;
  work_order_id: number;
  part_id: number;
  quantity: number;
  unit_price: string;
  total_price: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  status: "draft" | "paid" | "cancelled" | "refunded";
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  motorcycle_id: number | null;
  part_id: number | null;
  description: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  created_at: string;
}

export interface Return {
  id: number;
  invoice_id: number;
  reason: string;
  refund_amount: string;
  created_by: string | null;
  created_at: string;
}

export interface Inspection {
  id: number;
  motorcycle_id: number;
  inspector_id: string | null;
  overall_grade: "excellent" | "good" | "fair" | "poor";
  engine_condition: string | null;
  body_condition: string | null;
  electrical_condition: string | null;
  tires_condition: string | null;
  brake_condition: string | null;
  notes: string | null;
  image_urls: string[] | null;
  is_certified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: "create" | "update" | "delete";
  entity: string;
  entity_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface SiteSetting {
  id: number;
  key: string;
  value: string | null;
  updated_at: string | null;
}

export interface ContactSubmission {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean | null;
  created_at: string | null;
}

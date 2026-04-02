import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "./supabase";

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");
      if (error) throw new Error(error.message);
      const flat: Record<string, string | null> = {};
      for (const row of (data ?? [])) {
        flat[row.key] = row.value;
      }
      return flat;
    },
  });
}

export function useParts() {
  return useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("*, subcategories(id, name, category_id, categories(id, name))")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        condition: p.condition,
        subcategoryId: p.subcategory_id,
        subcategoryName: p.subcategories?.name ?? null,
        categoryId: p.subcategories?.category_id ?? null,
        categoryName: p.subcategories?.categories?.name ?? null,
        quantityOnHand: p.quantity_on_hand,
        sellingPrice: p.selling_price,
        imageUrl: p.image_url,
        modelCompatibility: p.model_compatibility,
      }));
    },
  });
}

export function useMotorcycles() {
  return useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*, motorcycle_brands(id, name), motorcycle_subcategories(id, name)")
        .order("make");
      if (error) throw new Error(error.message);
      return (data ?? []).map((m: any) => ({
        id: m.id,
        make: m.make,
        model: m.model,
        year: m.year,
        vin: m.vin,
        color: m.color,
        engineSize: m.engine_size,
        mileage: m.mileage,
        condition: m.condition,
        status: m.status,
        brandId: m.brand_id,
        brandName: m.motorcycle_brands?.name ?? null,
        motorcycleSubcategoryId: m.motorcycle_subcategory_id,
        subcategoryName: m.motorcycle_subcategories?.name ?? null,
        sellingPrice: m.selling_price,
        imageUrl: m.image_url,
        engineCc: m.engine_cc,
        topSpeed: m.top_speed,
        fuelCapacity: m.fuel_capacity,
        weight: m.weight,
        seatHeight: m.seat_height,
        transmission: m.transmission,
        fuelType: m.fuel_type,
        features: m.features,
      }));
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useMotorcycleBrands() {
  return useQuery({
    queryKey: ["motorcycle-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_brands").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useContact() {
  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("contact_submissions").insert({
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        subject: data.subject ?? null,
        message: data.message,
      });
      if (error) throw new Error(error.message);
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.username,
        password: credentials.password,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "RM 0.00";
  return `RM ${num.toFixed(2)}`;
}

export function getImageUrl(url: string | null | undefined) {
  if (!url) return "/images/part-placeholder.svg";
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return url;
}

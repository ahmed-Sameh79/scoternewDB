import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const defaultSettings: Record<string, string> = {
  hero_title_ar: "وجهتك الأولى لقطع غيار الموتوسيكلات",
  hero_title_en: "Your #1 Destination for Motorcycle Parts",
  hero_subtitle_ar: "أفضل جودة وأسعار تنافسية لجميع موديلات الموتوسيكلات والسكوتر",
  hero_subtitle_en: "Best quality and competitive prices for all motorcycle & scooter models",
  hero_image_url: "",
  about_title_ar: "من نحن",
  about_title_en: "About Us",
  about_text_ar: "شركة رائدة في مجال قطع غيار الموتوسيكلات والسكوتر، نوفر أفضل المنتجات بجودة عالية وأسعار تنافسية.",
  about_text_en: "A leading company in motorcycle and scooter spare parts, providing the best products with high quality and competitive prices.",
  whatsapp_number: "",
  google_play_url: "",
  app_store_url: "",
  google_maps_embed: "",
  address_ar: "",
  address_en: "",
  email: "",
  phone: "",
  facebook_url: "",
  instagram_url: "",
  twitter_url: "",
  youtube_url: "",
  company_name_ar: "متجر قطع غيار",
  company_name_en: "Parts Store",
};

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = { ...defaultSettings };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

router.put("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    const existing = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(siteSettingsTable).set({ value, updatedAt: new Date() }).where(eq(siteSettingsTable.key, key));
    } else {
      await db.insert(siteSettingsTable).values({ key, value });
    }
  }
  res.json({ success: true });
});

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
});

router.post("/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const { name, email, phone, subject, message } = parsed.data;
  const [submission] = await db.insert(contactSubmissionsTable).values({
    name, email: email || null, phone: phone || null, subject: subject || null, message,
  }).returning();
  res.status(201).json(submission);
});

router.get("/contact/submissions", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await db.select().from(contactSubmissionsTable).orderBy(contactSubmissionsTable.createdAt);
  res.json(rows.reverse());
});

router.patch("/contact/submissions/:id/read", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(contactSubmissionsTable).set({ isRead: true }).where(eq(contactSubmissionsTable.id, id));
  res.json({ success: true });
});

router.delete("/contact/submissions/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(contactSubmissionsTable).where(eq(contactSubmissionsTable.id, id));
  res.status(204).send();
});

export default router;

import { db } from "../../config/db.ts";

/**
 * Default Initial Settings if database is empty
 */
const DEFAULT_SETTINGS: Record<string, { value: any; group: string; description: string }> = {
  site_name: {
    value: "Shopora",
    group: "GENERAL",
    description: "Website Brand Name",
  },
  site_tagline: {
    value: "Modern Hybrid Multi-Vendor Marketplace",
    group: "GENERAL",
    description: "Store slogan / tagline",
  },
  site_logo: {
    value: "/logo.png",
    group: "GENERAL",
    description: "Main Logo URL",
  },
  contact_email: {
    value: "support@shopora.com",
    group: "GENERAL",
    description: "Support Email",
  },
  contact_phone: {
    value: "+8801700000000",
    group: "GENERAL",
    description: "Customer Service Hotline",
  },
  currency: {
    value: "BDT",
    group: "PAYMENT",
    description: "Store Currency Symbol/Code",
  },
  default_commission_rate: {
    value: 10.0,
    group: "COMMISSION",
    description: "Default platform commission percentage charged on third-party seller sales",
  },
  shipping_fee_standard: {
    value: 70,
    group: "SHIPPING",
    description: "Standard delivery charge in BDT",
  },
  free_shipping_threshold: {
    value: 1500,
    group: "SHIPPING",
    description: "Minimum order amount for free delivery",
  },
  meta_title: {
    value: "Shopora - Online Shopping in Bangladesh | Multi-Vendor Marketplace",
    group: "SEO",
    description: "Default website meta title for Google SEO",
  },
  meta_description: {
    value: "Shop thousands of genuine products directly from trusted sellers and official brands on Shopora. Fast delivery, secure payments & easy returns.",
    group: "SEO",
    description: "Default meta description for SEO indexing",
  },
};

/**
 * Get all public website settings as a key-value dictionary
 */
export const getAllSettings = async () => {
  const settings = await db.orm.public.WebsiteSetting.all();

  // If no settings exist yet, seed defaults
  if (settings.length === 0) {
    for (const [key, item] of Object.entries(DEFAULT_SETTINGS)) {
      await db.orm.public.WebsiteSetting.create({
        key,
        value: item.value,
        group: item.group,
        description: item.description,
      });
    }
    const fresh = await db.orm.public.WebsiteSetting.all();
    const result: Record<string, any> = {};
    for (const s of fresh) {
      result[s.key] = s.value;
    }
    return result;
  }

  const result: Record<string, any> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return result;
};

/**
 * Admin: Update one or multiple website settings
 */
export const updateSettings = async (payload: Record<string, any>) => {
  for (const [key, value] of Object.entries(payload)) {
    const existing = await db.orm.public.WebsiteSetting.where({ key }).first();
    if (existing) {
      await db.orm.public.WebsiteSetting.where({ key }).update({ value });
    } else {
      await db.orm.public.WebsiteSetting.create({
        key,
        value,
        group: "GENERAL",
        description: null,
      });
    }
  }

  return await getAllSettings();
};

export const SettingsService = {
  getAllSettings,
  updateSettings,
};

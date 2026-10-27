import { db } from "../../config/db.ts";

export const DEFAULT_SETTINGS: Record<string, { value: any; group: string; description: string }> = {
  // GENERAL
  site_name: {
    value: "Shopora",
    group: "GENERAL",
    description: "Website Brand Name",
  },
  site_tagline: {
    value: "Premier Hybrid Multi-Vendor E-Commerce Platform",
    group: "GENERAL",
    description: "Store slogan / tagline",
  },
  site_logo: {
    value: "/logo.png",
    group: "GENERAL",
    description: "Main Logo URL",
  },
  site_favicon: {
    value: "/favicon.ico",
    group: "GENERAL",
    description: "Favicon URL",
  },
  contact_email: {
    value: "support@shopora.com",
    group: "GENERAL",
    description: "Support Email Address",
  },
  contact_phone: {
    value: "+880 9612-345678",
    group: "GENERAL",
    description: "Customer Service Hotline",
  },
  contact_address: {
    value: "House 42, Road 11, Banani, Dhaka-1213, Bangladesh",
    group: "GENERAL",
    description: "Official Operating Address",
  },
  is_maintenance_mode: {
    value: false,
    group: "GENERAL",
    description: "Put store in temporary maintenance mode",
  },
  maintenance_message: {
    value: "Shopora is temporarily undergoing scheduled system upgrades. We will be back shortly!",
    group: "GENERAL",
    description: "Maintenance banner announcement",
  },

  // SHIPPING
  shipping_fee_standard: {
    value: 70,
    group: "SHIPPING",
    description: "Standard delivery charge inside Dhaka / Metro (BDT)",
  },
  shipping_fee_express: {
    value: 130,
    group: "SHIPPING",
    description: "Delivery fee outside Dhaka / nationwide (BDT)",
  },
  free_shipping_threshold: {
    value: 1500,
    group: "SHIPPING",
    description: "Minimum cart subtotal to qualify for free shipping (BDT)",
  },
  estimated_delivery_metro: {
    value: "2-3 Business Days",
    group: "SHIPPING",
    description: "Estimated delivery timeframe for metro areas",
  },
  estimated_delivery_national: {
    value: "4-6 Business Days",
    group: "SHIPPING",
    description: "Estimated delivery timeframe nationwide",
  },
  enable_free_shipping_promo: {
    value: true,
    group: "SHIPPING",
    description: "Enable platform-wide free delivery banner and incentive",
  },

  // COMMISSION & VENDORS
  default_commission_rate: {
    value: 10.0,
    group: "COMMISSION",
    description: "Default platform commission percentage charged on seller orders (%)",
  },
  min_payout_threshold: {
    value: 1000,
    group: "COMMISSION",
    description: "Minimum wallet earnings required for seller withdrawal request (BDT)",
  },
  auto_approve_sellers: {
    value: false,
    group: "COMMISSION",
    description: "Automatically approve new vendor registrations without manual review",
  },
  auto_approve_products: {
    value: false,
    group: "COMMISSION",
    description: "Automatically publish vendor products without admin approval",
  },

  // PAYMENT & CHECKOUT
  currency: {
    value: "BDT",
    group: "PAYMENT",
    description: "Store Currency Code",
  },
  currency_symbol: {
    value: "৳",
    group: "PAYMENT",
    description: "Currency Symbol",
  },
  enable_cod: {
    value: true,
    group: "PAYMENT",
    description: "Enable Cash on Delivery payment option",
  },
  enable_bkash: {
    value: true,
    group: "PAYMENT",
    description: "Enable bKash payment method",
  },
  bkash_merchant_number: {
    value: "01711000000",
    group: "PAYMENT",
    description: "bKash Merchant Account Number",
  },
  enable_nagad: {
    value: true,
    group: "PAYMENT",
    description: "Enable Nagad payment method",
  },
  nagad_merchant_number: {
    value: "01811000000",
    group: "PAYMENT",
    description: "Nagad Merchant Account Number",
  },
  vat_percentage: {
    value: 0,
    group: "PAYMENT",
    description: "Standard VAT/Tax percentage applied at checkout (%)",
  },
  allow_guest_checkout: {
    value: true,
    group: "PAYMENT",
    description: "Allow visitors to checkout without creating an account",
  },

  // SEO & SOCIAL
  meta_title: {
    value: "Shopora | Hybrid Multi-Vendor E-Commerce Platform",
    group: "SEO",
    description: "Default website meta title for Google SEO",
  },
  meta_description: {
    value: "Shop thousands of genuine products directly from verified sellers and top brands on Shopora Bangladesh.",
    group: "SEO",
    description: "Default meta description for search engine previews",
  },
  meta_keywords: {
    value: "online shopping, bangladesh, ecommerce, marketplace, electronics, fashion, gadgets",
    group: "SEO",
    description: "Default meta keywords",
  },
  google_analytics_id: {
    value: "",
    group: "SEO",
    description: "Google Analytics 4 Measurement ID",
  },
  facebook_pixel_id: {
    value: "",
    group: "SEO",
    description: "Meta / Facebook Pixel ID",
  },
  social_facebook: {
    value: "https://facebook.com/shopora.bd",
    group: "SOCIAL",
    description: "Facebook Page URL",
  },
  social_instagram: {
    value: "https://instagram.com/shopora.bd",
    group: "SOCIAL",
    description: "Instagram Profile URL",
  },
  social_youtube: {
    value: "https://youtube.com/@shopora",
    group: "SOCIAL",
    description: "YouTube Channel URL",
  },
  social_twitter: {
    value: "https://x.com/shoporabd",
    group: "SOCIAL",
    description: "X (formerly Twitter) URL",
  },

  // NOTIFICATIONS
  low_stock_threshold: {
    value: 5,
    group: "NOTIFICATIONS",
    description: "Product inventory level that triggers low stock warning",
  },
  notify_admin_on_order: {
    value: true,
    group: "NOTIFICATIONS",
    description: "Send alert to store administrators when a new order is placed",
  },
  notify_admin_on_seller_signup: {
    value: true,
    group: "NOTIFICATIONS",
    description: "Send alert when a new merchant applies to be a vendor",
  },
};

/**
 * Get all public website settings as a key-value dictionary.
 * Ensures any missing settings from DEFAULT_SETTINGS are automatically backfilled.
 */
export const getAllSettings = async () => {
  const settings = await db.orm.public.WebsiteSetting.all();
  const existingMap = new Map(settings.map((s) => [s.key, s]));

  // Backfill any missing default settings
  const toCreate = Object.entries(DEFAULT_SETTINGS).filter(([k]) => !existingMap.has(k));
  if (toCreate.length > 0) {
    for (const [key, item] of toCreate) {
      await db.orm.public.WebsiteSetting.create({
        key,
        value: item.value,
        group: item.group,
        description: item.description,
      });
    }
  }

  const all = await db.orm.public.WebsiteSetting.all();
  const result: Record<string, any> = {};
  for (const s of all) {
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
    const defaultMeta = DEFAULT_SETTINGS[key];
    if (existing) {
      await db.orm.public.WebsiteSetting.where({ key }).update({ value });
    } else {
      await db.orm.public.WebsiteSetting.create({
        key,
        value,
        group: defaultMeta?.group ?? "GENERAL",
        description: defaultMeta?.description ?? null,
      });
    }
  }

  return await getAllSettings();
};

export const SettingsService = {
  getAllSettings,
  updateSettings,
};

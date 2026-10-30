import crypto from "node:crypto";
import { db } from "../config/db.ts";
import { hashPassword } from "../utils/hash.ts";
import {
  USER_ROLES,
  SELLER_STATUS,
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  PRODUCT_TYPE,
} from "../constants/index.ts";

async function main() {
  console.log("🌱 Starting Comprehensive Shopora Database Seed...");

  // ==========================================
  // 1. SEED USERS (Admin, Sellers, Customers)
  // ==========================================
  console.log("👤 Seeding Users & Vendor Profiles...");
  const adminPassword = await hashPassword("Admin@123456");
  const sellerPassword = await hashPassword("Seller@123456");
  const customerPassword = await hashPassword("Customer@123456");

  // 1.1 Super Admin
  let admin = await db.orm.public.User.where({ email: "admin@shopora.com" }).first();
  if (!admin) {
    admin = await db.orm.public.User.create({
      name: "Shopora Super Admin",
      email: "admin@shopora.com",
      password: adminPassword,
      role: USER_ROLES.ADMIN,
      phone: "+8801711000001",
      isVerified: true,
      isActive: true,
    });
  }

  // 1.2 Seller 1: Apex Tech & Gadgets (Gadgets & Electronics)
  let sellerUser1 = await db.orm.public.User.where({ email: "apex.seller@shopora.com" }).first();
  if (!sellerUser1) {
    sellerUser1 = await db.orm.public.User.create({
      name: "Tanzim Rahman",
      email: "apex.seller@shopora.com",
      password: sellerPassword,
      role: USER_ROLES.SELLER,
      phone: "+8801711000002",
      isVerified: true,
      isActive: true,
    });
  }

  let sellerProfile1 = await db.orm.public.SellerProfile.where({ storeSlug: "apex-tech-gadgets" }).first();
  if (!sellerProfile1) {
    sellerProfile1 = await db.orm.public.SellerProfile.create({
      userId: sellerUser1.id,
      storeName: "Apex Tech & Gadgets",
      storeSlug: "apex-tech-gadgets",
      storeDescription: "Authorized retailer of genuine mobile phones, fast chargers and premium lifestyle tech.",
      phone: "+8801711000002",
      businessAddress: "Bashundhara City Shopping Complex, Level 5, Block B, Panthapath, Dhaka",
      taxNumber: "TIN-98472918",
      nidOrTradeLicense: "TRAD/DSCC/019284/2026",
      status: SELLER_STATUS.APPROVED,
      commissionRate: 8.0,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    });

    await db.orm.public.SellerWallet.create({
      sellerId: sellerProfile1.id,
      balance: 48500.0,
      pendingBalance: 8200.0,
      totalWithdrawn: 120000.0,
      totalEarnings: 176700.0,
      totalCommissionPaid: 15380.0,
    });
  }

  // 1.3 Seller 2: ByteTech Official (Audio, Computing & Gaming)
  let sellerUser2 = await db.orm.public.User.where({ email: "bytetech@shopora.com" }).first();
  if (!sellerUser2) {
    sellerUser2 = await db.orm.public.User.create({
      name: "Fahim Shahriar",
      email: "bytetech@shopora.com",
      password: sellerPassword,
      role: USER_ROLES.SELLER,
      phone: "+8801711000004",
      isVerified: true,
      isActive: true,
    });
  }

  let sellerProfile2 = await db.orm.public.SellerProfile.where({ storeSlug: "bytetech-official" }).first();
  if (!sellerProfile2) {
    sellerProfile2 = await db.orm.public.SellerProfile.create({
      userId: sellerUser2.id,
      storeName: "ByteTech Official",
      storeSlug: "bytetech-official",
      storeDescription: "Official importer of top tier TWS earbuds, mechanical keyboards and computing accessories.",
      phone: "+8801711000004",
      businessAddress: "Multiplan Center, Level 4, Shop 412, Elephant Road, Dhaka",
      taxNumber: "TIN-77621980",
      nidOrTradeLicense: "TRAD/DSCC/032918/2026",
      status: SELLER_STATUS.APPROVED,
      commissionRate: 7.5,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    });

    await db.orm.public.SellerWallet.create({
      sellerId: sellerProfile2.id,
      balance: 32000.0,
      pendingBalance: 5400.0,
      totalWithdrawn: 85000.0,
      totalEarnings: 122400.0,
      totalCommissionPaid: 9900.0,
    });
  }

  // 1.4 Seller 3: Apparel Studio BD (Fashion & Apparel)
  let sellerUser3 = await db.orm.public.User.where({ email: "apparel.bd@shopora.com" }).first();
  if (!sellerUser3) {
    sellerUser3 = await db.orm.public.User.create({
      name: "Nusrat Jahan",
      email: "apparel.bd@shopora.com",
      password: sellerPassword,
      role: USER_ROLES.SELLER,
      phone: "+8801711000005",
      isVerified: true,
      isActive: true,
    });
  }

  let sellerProfile3 = await db.orm.public.SellerProfile.where({ storeSlug: "apparel-studio-bd" }).first();
  if (!sellerProfile3) {
    sellerProfile3 = await db.orm.public.SellerProfile.create({
      userId: sellerUser3.id,
      storeName: "Apparel Studio BD",
      storeSlug: "apparel-studio-bd",
      storeDescription: "Handcrafted 100% combed cotton casual shirts, formal wear and urban streetwear.",
      phone: "+8801711000005",
      businessAddress: "Sector 3, Road 7, Uttara, Dhaka",
      taxNumber: "TIN-55198273",
      nidOrTradeLicense: "TRAD/DNCC/082194/2026",
      status: SELLER_STATUS.APPROVED,
      commissionRate: 10.0,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    });

    await db.orm.public.SellerWallet.create({
      sellerId: sellerProfile3.id,
      balance: 19500.0,
      pendingBalance: 3200.0,
      totalWithdrawn: 45000.0,
      totalEarnings: 67700.0,
      totalCommissionPaid: 7520.0,
    });
  }

  // 1.5 Customers
  let customer1 = await db.orm.public.User.where({ email: "rahim@shopora.com" }).first();
  if (!customer1) {
    customer1 = await db.orm.public.User.create({
      name: "Rahim Chowdhury",
      email: "rahim@shopora.com",
      password: customerPassword,
      role: USER_ROLES.CUSTOMER,
      phone: "+8801711000003",
      isVerified: true,
      isActive: true,
    });

    await db.orm.public.Address.create({
      userId: customer1.id,
      fullName: "Rahim Chowdhury",
      phone: "+8801711000003",
      streetAddress: "House 42, Road 11, Block D, Banani",
      city: "Dhaka",
      state: "Dhaka Division",
      postalCode: "1213",
      country: "Bangladesh",
      isDefault: true,
      type: "SHIPPING",
    });
  }

  let customer2 = await db.orm.public.User.where({ email: "sadia.akter@shopora.com" }).first();
  if (!customer2) {
    customer2 = await db.orm.public.User.create({
      name: "Sadia Akter",
      email: "sadia.akter@shopora.com",
      password: customerPassword,
      role: USER_ROLES.CUSTOMER,
      phone: "+8801811000006",
      isVerified: true,
      isActive: true,
    });

    await db.orm.public.Address.create({
      userId: customer2.id,
      fullName: "Sadia Akter",
      phone: "+8801811000006",
      streetAddress: "Amanat Tower, GEC Circle, Nasirabad",
      city: "Chattogram",
      state: "Chattogram Division",
      postalCode: "4000",
      country: "Bangladesh",
      isDefault: true,
      type: "SHIPPING",
    });
  }

  // ==========================================
  // 2. HELPER: MEDIA & USEMEDIA PIPELINE
  // ==========================================
  console.log("📸 Setting up Media & UseMedia Pipeline...");
  async function getOrCreateUseMedia(
    url: string,
    alt: string,
    description: string,
    userId: string,
    sellerId: string | null = null
  ) {
    const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
    const publicId = `shopora_${hash}`;
    let media = await db.orm.public.Media.where({ publicId }).first();
    if (!media) {
      media = await db.orm.public.Media.create({
        url,
        publicId,
        format: "jpg",
        bytes: 145000,
        width: 800,
        height: 800,
        originalFilename: alt.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        folder: "shopora",
        userId,
        sellerId,
      });
    }

    let useMedia = await db.orm.public.UseMedia.where({ mediaId: media.id }).first();
    if (!useMedia) {
      useMedia = await db.orm.public.UseMedia.create({
        mediaId: media.id,
        alt,
        description,
        userId,
        sellerId,
      });
    }

    return { mediaId: media.id, useMediaId: useMedia.id, url };
  }

  // ==========================================
  // 3. SEED HIERARCHICAL CATEGORIES
  // ==========================================
  console.log("📂 Seeding Hierarchical Categories...");
  const catElectronicsImg = await getOrCreateUseMedia(
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800",
    "Electronics and Gadgets",
    "Category cover for electronics",
    admin.id
  );

  let electronics = await db.orm.public.Category.where({ slug: "electronics" }).first();
  if (!electronics) {
    electronics = await db.orm.public.Category.create({
      name: "Electronics & Gadgets",
      slug: "electronics",
      description: "Smartphones, Laptops, Audio, Smartwatches and Accessories",
      imageId: catElectronicsImg.useMediaId,
      icon: "laptop",
      displayOrder: 1,
      isActive: true,
    });
  }

  const subCategories = [
    { name: "Smartwatches & Wearables", slug: "smartwatches", parentId: electronics.id, order: 1 },
    { name: "Audio & Headphones", slug: "audio-headphones", parentId: electronics.id, order: 2 },
    { name: "Computer Accessories", slug: "computer-accessories", parentId: electronics.id, order: 3 },
    { name: "Power Banks & Chargers", slug: "powerbanks", parentId: electronics.id, order: 4 },
    { name: "Smartphones & Mobile", slug: "smartphones", parentId: electronics.id, order: 5 },
  ];

  for (const sc of subCategories) {
    const existing = await db.orm.public.Category.where({ slug: sc.slug }).first();
    if (!existing) {
      await db.orm.public.Category.create({
        name: sc.name,
        slug: sc.slug,
        parentId: sc.parentId,
        displayOrder: sc.order,
        isActive: true,
      });
    }
  }

  const catFashionImg = await getOrCreateUseMedia(
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
    "Fashion and Apparel",
    "Category cover for fashion",
    admin.id
  );

  let fashion = await db.orm.public.Category.where({ slug: "fashion" }).first();
  if (!fashion) {
    fashion = await db.orm.public.Category.create({
      name: "Fashion & Lifestyle",
      slug: "fashion",
      description: "Men and Women Clothing, Leather Accessories and Bags",
      imageId: catFashionImg.useMediaId,
      icon: "shirt",
      displayOrder: 2,
      isActive: true,
    });

    await db.orm.public.Category.create({
      name: "Men's Clothing",
      slug: "mens-clothing",
      parentId: fashion.id,
      displayOrder: 1,
      isActive: true,
    });

    await db.orm.public.Category.create({
      name: "Leather Goods & Bags",
      slug: "leather-goods",
      parentId: fashion.id,
      displayOrder: 2,
      isActive: true,
    });
  }

  let homeCat = await db.orm.public.Category.where({ slug: "home-lifestyle" }).first();
  if (!homeCat) {
    homeCat = await db.orm.public.Category.create({
      name: "Home & Lifestyle",
      slug: "home-lifestyle",
      description: "Smart home appliances, robot vacuums, and decor",
      icon: "home",
      displayOrder: 3,
      isActive: true,
    });
  }

  // ==========================================
  // 4. SEED POPULAR BRANDS
  // ==========================================
  console.log("🏷️ Seeding Brands...");
  const brandList = [
    { name: "Kieslect", slug: "kieslect", website: "https://www.kieslect.com", desc: "Trendy smartwatch and health wearable manufacturer", logo: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300" },
    { name: "Anker", slug: "anker", website: "https://www.anker.com", desc: "Global leader in fast charging and acoustic sound innovations", logo: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300" },
    { name: "Logitech", slug: "logitech", website: "https://www.logitech.com", desc: "Premier Swiss computer peripherals and productivity mice", logo: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300" },
    { name: "Baseus", slug: "baseus", website: "https://www.baseus.com", desc: "Based on User - Sleek chargers, power banks and cables", logo: "https://images.unsplash.com/photo-1622445262464-84b14e0745b1?w=300" },
    { name: "Redragon", slug: "redragon", website: "https://www.redragonzone.com", desc: "High-performance mechanical keyboards and gaming hardware", logo: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300" },
    { name: "Artisan Crafts", slug: "artisan-crafts", website: "https://artisancrafts.bd", desc: "Premium handcrafted full-grain leather goods and wallets", logo: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=300" },
    { name: "JBL", slug: "jbl", website: "https://www.jbl.com", desc: "World class acoustics, waterproof speakers and sound systems", logo: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=300" },
    { name: "Samsung", slug: "samsung", website: "https://www.samsung.com", desc: "Galaxy AI powered flagship smartphones and consumer electronics", logo: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=300" },
    { name: "Xiaomi", slug: "xiaomi", website: "https://www.mi.com", desc: "Smart AIoT robotics, vacuum cleaners, and smart devices", logo: "https://images.unsplash.com/photo-1558002038-1055907df827?w=300" },
    { name: "Apple", slug: "apple", website: "https://www.apple.com", desc: "Pioneering iPad, iPhone, and Apple Silicon devices", logo: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300" },
    { name: "Ugreen", slug: "ugreen", website: "https://www.ugreen.com", desc: "Next-gen GaN desktop fast chargers and USB accessories", logo: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300" },
    { name: "Urban Weave", slug: "urban-weave", website: "https://urbanweave.bd", desc: "100% breathable organic combed cotton apparel brand", logo: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300" },
    { name: "Shopora Direct", slug: "shopora-direct", website: "https://shopora.com", desc: "Shopora platform direct certified genuine products", logo: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300" },
  ];

  const brandMap: Record<string, any> = {};
  for (const b of brandList) {
    const brandImg = await getOrCreateUseMedia(b.logo, `${b.name} Brand Logo`, `Official brand logo for ${b.name}`, admin.id);
    let brandRecord = await db.orm.public.Brand.where({ slug: b.slug }).first();
    if (!brandRecord) {
      brandRecord = await db.orm.public.Brand.create({
        name: b.name,
        slug: b.slug,
        website: b.website,
        description: b.desc,
        logoId: brandImg.useMediaId,
        isActive: true,
      });
    } else {
      await db.orm.public.Brand.where({ id: brandRecord.id }).update({
        logoId: brandImg.useMediaId,
      });
      brandRecord = await db.orm.public.Brand.where({ id: brandRecord.id }).first();
    }
    brandMap[b.slug] = brandRecord;
  }

  // ==========================================
  // 5. SEED ATTRIBUTES & ATTRIBUTE VALUES
  // ==========================================
  console.log("⚙️ Seeding Relational Attributes & Value Swatches...");
  
  // 5.1 Color Attribute (Type: COLOR)
  let attrColor = await db.orm.public.Attribute.where({ slug: "color" }).first();
  if (!attrColor) {
    attrColor = await db.orm.public.Attribute.create({
      name: "Color",
      slug: "color",
      type: "COLOR",
      description: "Visual product color swatch",
      displayOrder: 1,
      isActive: true,
    });
  }

  const colorValues = [
    { value: "Jet Black", colorCode: "#111827", order: 1 },
    { value: "Silver Chrome", colorCode: "#E5E7EB", order: 2 },
    { value: "Midnight Blue", colorCode: "#1E3A8A", order: 3 },
    { value: "Olive Green", colorCode: "#4B5320", order: 4 },
    { value: "Glacier White", colorCode: "#FFFFFF", order: 5 },
    { value: "Graphite Gray", colorCode: "#374151", order: 6 },
    { value: "Antique Brown", colorCode: "#8B4513", order: 7 },
    { value: "Titanium Black", colorCode: "#1F2421", order: 8 },
    { value: "Titanium Gray", colorCode: "#6B7280", order: 9 },
  ];

  const colorValMap: Record<string, any> = {};
  for (const cv of colorValues) {
    let val = await db.orm.public.AttributeValue
      .where({ attributeId: attrColor.id })
      .where({ value: cv.value })
      .first();
    if (!val) {
      val = await db.orm.public.AttributeValue.create({
        attributeId: attrColor.id,
        value: cv.value,
        colorCode: cv.colorCode,
        displayOrder: cv.order,
      });
    }
    colorValMap[cv.value] = val;
  }

  // 5.2 Size Attribute (Type: BUTTON)
  let attrSize = await db.orm.public.Attribute.where({ slug: "size" }).first();
  if (!attrSize) {
    attrSize = await db.orm.public.Attribute.create({
      name: "Size",
      slug: "size",
      type: "BUTTON",
      description: "Standard clothing size selection",
      displayOrder: 2,
      isActive: true,
    });
  }

  const sizeValues = ["M", "L", "XL", "XXL"];
  const sizeValMap: Record<string, any> = {};
  for (let i = 0; i < sizeValues.length; i++) {
    const s = sizeValues[i];
    let val = await db.orm.public.AttributeValue
      .where({ attributeId: attrSize.id })
      .where({ value: s })
      .first();
    if (!val) {
      val = await db.orm.public.AttributeValue.create({
        attributeId: attrSize.id,
        value: s,
        displayOrder: i + 1,
      });
    }
    sizeValMap[s] = val;
  }

  // 5.3 Storage Attribute (Type: BUTTON)
  let attrStorage = await db.orm.public.Attribute.where({ slug: "storage" }).first();
  if (!attrStorage) {
    attrStorage = await db.orm.public.Attribute.create({
      name: "Internal Storage",
      slug: "storage",
      type: "BUTTON",
      description: "Built-in device memory capacity",
      displayOrder: 3,
      isActive: true,
    });
  }

  const storageValues = ["64GB", "128GB", "256GB", "512GB"];
  const storageValMap: Record<string, any> = {};
  for (let i = 0; i < storageValues.length; i++) {
    const st = storageValues[i];
    let val = await db.orm.public.AttributeValue
      .where({ attributeId: attrStorage.id })
      .where({ value: st })
      .first();
    if (!val) {
      val = await db.orm.public.AttributeValue.create({
        attributeId: attrStorage.id,
        value: st,
        displayOrder: i + 1,
      });
    }
    storageValMap[st] = val;
  }

  // 5.4 Strap Material Attribute (Type: SELECT)
  let attrStrap = await db.orm.public.Attribute.where({ slug: "strap-material" }).first();
  if (!attrStrap) {
    attrStrap = await db.orm.public.Attribute.create({
      name: "Strap Material",
      slug: "strap-material",
      type: "SELECT",
      description: "Smartwatch wrist band type",
      displayOrder: 4,
      isActive: true,
    });
  }

  const strapValues = ["Magnetic Metal Mesh", "Breathable Silicone"];
  const strapValMap: Record<string, any> = {};
  for (let i = 0; i < strapValues.length; i++) {
    const sm = strapValues[i];
    let val = await db.orm.public.AttributeValue
      .where({ attributeId: attrStrap.id })
      .where({ value: sm })
      .first();
    if (!val) {
      val = await db.orm.public.AttributeValue.create({
        attributeId: attrStrap.id,
        value: sm,
        displayOrder: i + 1,
      });
    }
    strapValMap[sm] = val;
  }

  // 5.5 Mechanical Switch Type (Type: BUTTON)
  let attrSwitch = await db.orm.public.Attribute.where({ slug: "switch-type" }).first();
  if (!attrSwitch) {
    attrSwitch = await db.orm.public.Attribute.create({
      name: "Mechanical Switch",
      slug: "switch-type",
      type: "BUTTON",
      description: "Keyboard key switch mechanism",
      displayOrder: 5,
      isActive: true,
    });
  }

  const switchValues = ["Tactile Blue Switch", "Linear Red Switch"];
  const switchValMap: Record<string, any> = {};
  for (let i = 0; i < switchValues.length; i++) {
    const sw = switchValues[i];
    let val = await db.orm.public.AttributeValue
      .where({ attributeId: attrSwitch.id })
      .where({ value: sw })
      .first();
    if (!val) {
      val = await db.orm.public.AttributeValue.create({
        attributeId: attrSwitch.id,
        value: sw,
        displayOrder: i + 1,
      });
    }
    switchValMap[sw] = val;
  }

  // 5.6 Specification Attribute: Material (Type: SELECT, Non-variation)
  let attrMaterial = await db.orm.public.Attribute.where({ slug: "material" }).first();
  if (!attrMaterial) {
    attrMaterial = await db.orm.public.Attribute.create({
      name: "Material",
      slug: "material",
      type: "SELECT",
      description: "Product composition or fabric",
      displayOrder: 6,
      isActive: true,
    });
  }

  // 5.7 Specification Attribute: Connectivity (Type: SELECT, Non-variation)
  let attrConn = await db.orm.public.Attribute.where({ slug: "connectivity" }).first();
  if (!attrConn) {
    attrConn = await db.orm.public.Attribute.create({
      name: "Connectivity",
      slug: "connectivity",
      type: "SELECT",
      description: "Wireless and wired connection protocol",
      displayOrder: 7,
      isActive: true,
    });
  }

  // ==========================================
  // 6. SEED 12 REALISTIC PRODUCTS
  // ==========================================
  console.log("📦 Seeding 12 Realistic Multi-Vendor Products with Media & Attributes...");

  // Fetch resolved categories
  const catSmartwatch = await db.orm.public.Category.where({ slug: "smartwatches" }).first();
  const catAudio = await db.orm.public.Category.where({ slug: "audio-headphones" }).first();
  const catClothing = await db.orm.public.Category.where({ slug: "mens-clothing" }).first();
  const catComputer = await db.orm.public.Category.where({ slug: "computer-accessories" }).first();
  const catPowerbank = await db.orm.public.Category.where({ slug: "powerbanks" }).first();
  const catLeather = await db.orm.public.Category.where({ slug: "leather-goods" }).first();
  const catPhone = await db.orm.public.Category.where({ slug: "smartphones" }).first();

  // ----------------------------------------------------
  // PRODUCT 1: Kieslect Kr Pro Smartwatch (Variable, Platform-Owned)
  // ----------------------------------------------------
  if (catSmartwatch) {
    const img1 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
      "Kieslect Kr Pro Amoled Smartwatch",
      "High resolution front view of Kieslect Kr Pro smartwatch",
      admin.id
    );

    let p1 = await db.orm.public.Product.where({ slug: "kieslect-kr-pro-amoled-smartwatch" }).first();
    if (!p1) {
      p1 = await db.orm.public.Product.create({
        name: "Kieslect Kr Pro Amoled Calling Smartwatch with Double Straps",
        slug: "kieslect-kr-pro-amoled-smartwatch",
        sku: "KIES-KRPRO-001",
        shortDescription: "1.43-inch Ultra FHD Crystal Clear AMOLED display, Bluetooth 5.2 phone calls, and 70 sports modes.",
        description: `<h3>Premium Calling Smartwatch with Dual Straps</h3>
<p>The Kieslect Kr Pro is equipped with a stunning 1.43-inch Ultra FHD AMOLED display with 466*466 pixels and 400 nits brightness. Enjoy super convenient Bluetooth phone calling with a high-fidelity speaker and microphone.</p>
<ul>
  <li>Double Straps Included: Premium Magnetic Metal Mesh + Soft Silicone Strap</li>
  <li>Always-On Display (AOD) with vibrant watch faces</li>
  <li>24H Heart Rate, SpO2 Blood Oxygen, and Sleep Quality Tracking</li>
  <li>7-Day typical battery life and 2.5-hour fast magnetic charging</li>
  <li>IP68 Water Resistance for swimming and workouts</li>
</ul>`,
        categoryId: catSmartwatch.id,
        brandId: brandMap["kieslect"]?.id ?? null,
        sellerId: null, // Platform-owned
        isPlatformOwned: true,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 5499.0,
        comparePrice: 6999.0,
        costPrice: 3800.0,
        stock: 50,
        lowStockThreshold: 8,
        mainImageId: img1.useMediaId,
        tags: ["smartwatch", "calling", "amoled", "kieslect", "fitness"],
        warranty: "1 Year Official Replacement Warranty",
        weightKg: 0.18,
        dimensions: { length: 10, width: 8, height: 6 },
        videoUrl: "https://www.youtube.com/watch?v=example-kieslect",
        trackStock: true,
        isFreeShipping: true,
        isFeatured: true,
        isTrending: true,
        ratingAverage: 4.9,
        ratingCount: 32,
        totalSold: 114,
      });

      // Product Attributes
      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p1.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Jet Black"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Silver Chrome"].id });

      const paStrap = await db.orm.public.ProductAttribute.create({
        productId: p1.id,
        attributeId: attrStrap.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStrap.id, attributeValueId: strapValMap["Magnetic Metal Mesh"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStrap.id, attributeValueId: strapValMap["Breathable Silicone"].id });

      // Variants
      const vKies = [
        { title: "Jet Black / Magnetic Metal Mesh", sku: "KIES-KRPRO-BLK-MAG", price: 5699, stock: 15, color: "Jet Black", strap: "Magnetic Metal Mesh" },
        { title: "Jet Black / Breathable Silicone", sku: "KIES-KRPRO-BLK-SIL", price: 5499, stock: 15, color: "Jet Black", strap: "Breathable Silicone" },
        { title: "Silver Chrome / Magnetic Metal Mesh", sku: "KIES-KRPRO-SLV-MAG", price: 5699, stock: 10, color: "Silver Chrome", strap: "Magnetic Metal Mesh" },
        { title: "Silver Chrome / Breathable Silicone", sku: "KIES-KRPRO-SLV-SIL", price: 5499, stock: 10, color: "Silver Chrome", strap: "Breathable Silicone" },
      ];

      for (const v of vKies) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p1.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 6999,
          costPrice: 3800,
          stock: v.stock,
          imageId: img1.useMediaId,
          attributes: { Color: v.color, "Strap Material": v.strap },
          barcode: `890128${Math.floor(100000 + Math.random() * 900000)}`,
          weightKg: 0.18,
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrStrap.id,
          attributeValueId: strapValMap[v.strap].id,
        });
      }

      // Review
      await db.orm.public.ProductReview.create({
        productId: p1.id,
        userId: customer1.id,
        rating: 5,
        title: "Best budget AMOLED calling watch in BD!",
        comment: "The display is exceptionally sharp and the Bluetooth calls sound clear indoors and on bike rides. Battery lasted 6 full days on a single charge.",
        images: [img1.url],
        isVerifiedPurchase: true,
        isApproved: true,
      });
    }
  }

  // ----------------------------------------------------
  // PRODUCT 2: Anker Soundcore Life P2i TWS Earbuds (Variable, Vendor: ByteTech)
  // ----------------------------------------------------
  if (catAudio && sellerProfile2) {
    const img2 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800",
      "Anker Soundcore Life P2i Earbuds",
      "Earbuds in charging case",
      sellerUser2.id,
      sellerProfile2.id
    );

    let p2 = await db.orm.public.Product.where({ slug: "anker-soundcore-life-p2i-earbuds" }).first();
    if (!p2) {
      p2 = await db.orm.public.Product.create({
        name: "Anker Soundcore Life P2i True Wireless Earbuds with 28H Playtime",
        slug: "anker-soundcore-life-p2i-earbuds",
        sku: "ANK-P2I-001",
        shortDescription: "10mm Graphene Drivers, 2 EQ Modes (Bass & Podcast), and dual AI microphones for clear calls.",
        description: "<p>Deep, punchy bass tuned by Soundcore's signature acoustic team. Fast charge gives 1 hour of playtime from just 10 minutes of charging via USB Type-C.</p>",
        categoryId: catAudio.id,
        brandId: brandMap["anker"]?.id ?? null,
        sellerId: sellerProfile2.id, // Vendor Product!
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 2299.0,
        comparePrice: 2850.0,
        costPrice: 1600.0,
        stock: 60,
        mainImageId: img2.useMediaId,
        tags: ["anker", "soundcore", "earbuds", "tws", "wireless"],
        warranty: "18 Months Official Anker Replacement Warranty",
        ratingAverage: 4.8,
        ratingCount: 19,
        totalSold: 64,
        isFeatured: true,
        isTrending: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p2.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Jet Black"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Glacier White"].id });

      const vEar = [
        { title: "Matte Black", sku: "ANK-P2I-BLK", price: 2299, stock: 35, color: "Jet Black" },
        { title: "Glacier White", sku: "ANK-P2I-WHT", price: 2350, stock: 25, color: "Glacier White" },
      ];

      for (const v of vEar) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p2.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 2850,
          costPrice: 1600,
          stock: v.stock,
          imageId: img2.useMediaId,
          attributes: { Color: v.color },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
      }

      await db.orm.public.ProductReview.create({
        productId: p2.id,
        userId: customer2.id,
        rating: 5,
        title: "Tremendous bass and battery life",
        comment: "Original Anker product verified by barcode. Bass boost mode is powerful for hip-hop and gaming.",
        images: [],
        isVerifiedPurchase: true,
        isApproved: true,
      });
    }
  }

  // ----------------------------------------------------
  // PRODUCT 3: Casual Cotton Oxford Shirt (Variable, Vendor: Apparel Studio)
  // ----------------------------------------------------
  if (catClothing && sellerProfile3) {
    const img3 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800",
      "Casual Cotton Oxford Shirt",
      "Model wearing blue cotton shirt",
      sellerUser3.id,
      sellerProfile3.id
    );

    let p3 = await db.orm.public.Product.where({ slug: "premium-slim-fit-casual-cotton-shirt" }).first();
    if (!p3) {
      p3 = await db.orm.public.Product.create({
        name: "Premium Slim-Fit Breathable Casual Cotton Oxford Shirt",
        slug: "premium-slim-fit-casual-cotton-shirt",
        sku: "URB-SHIRT-001",
        shortDescription: "Tailored from 100% pre-washed organic Oxford cotton. Perfect for office and weekend smart casual.",
        description: "<p>Soft to touch and highly breathable in Bangladesh summer weather. Features double-stitched buttons and semi-spread collar.</p>",
        categoryId: catClothing.id,
        brandId: brandMap["urban-weave"]?.id ?? null,
        sellerId: sellerProfile3.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 1250.0,
        comparePrice: 1650.0,
        costPrice: 720.0,
        stock: 55,
        mainImageId: img3.useMediaId,
        tags: ["cotton", "shirt", "formal", "casual", "mens fashion"],
        warranty: "7 Days Easy Replacement Warranty",
        ratingAverage: 4.7,
        ratingCount: 14,
        totalSold: 38,
        isFeatured: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p3.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Midnight Blue"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Olive Green"].id });

      const paSize = await db.orm.public.ProductAttribute.create({
        productId: p3.id,
        attributeId: attrSize.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paSize.id, attributeValueId: sizeValMap["M"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paSize.id, attributeValueId: sizeValMap["L"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paSize.id, attributeValueId: sizeValMap["XL"].id });

      const vShirt = [
        { title: "Midnight Blue / M", color: "Midnight Blue", size: "M", price: 1250, stock: 12, sku: "URB-SHIRT-BLU-M" },
        { title: "Midnight Blue / L", color: "Midnight Blue", size: "L", price: 1250, stock: 15, sku: "URB-SHIRT-BLU-L" },
        { title: "Midnight Blue / XL", color: "Midnight Blue", size: "XL", price: 1250, stock: 8, sku: "URB-SHIRT-BLU-XL" },
        { title: "Olive Green / M", color: "Olive Green", size: "M", price: 1290, stock: 10, sku: "URB-SHIRT-OLV-M" },
        { title: "Olive Green / L", color: "Olive Green", size: "L", price: 1290, stock: 10, sku: "URB-SHIRT-OLV-L" },
      ];

      for (const v of vShirt) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p3.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 1650,
          costPrice: 720,
          stock: v.stock,
          imageId: img3.useMediaId,
          attributes: { Color: v.color, Size: v.size },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrSize.id,
          attributeValueId: sizeValMap[v.size].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 4: Logitech MX Master 3S Mouse (Variable, Platform-Owned)
  // ----------------------------------------------------
  if (catComputer) {
    const img4 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800",
      "Logitech MX Master 3S Ergonomic Mouse",
      "Product showcase of Logitech MX Master 3S",
      admin.id
    );

    let p4 = await db.orm.public.Product.where({ slug: "logitech-mx-master-3s-mouse" }).first();
    if (!p4) {
      p4 = await db.orm.public.Product.create({
        name: "Logitech MX Master 3S Wireless Ergonomic Performance Mouse",
        slug: "logitech-mx-master-3s-mouse",
        sku: "LOGI-MX3S-001",
        shortDescription: "Quiet clicks with 8000 DPI Darkfield sensor that tracks on glass. MagSpeed electromagnetic scrolling.",
        description: "<p>The master of productivity mice. Connects up to 3 devices via Bluetooth Low Energy or Logi Bolt receiver. Up to 70 days on a single full charge.</p>",
        categoryId: catComputer.id,
        brandId: brandMap["logitech"]?.id ?? null,
        sellerId: null,
        isPlatformOwned: true,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 10499.0,
        comparePrice: 12500.0,
        costPrice: 7800.0,
        stock: 25,
        mainImageId: img4.useMediaId,
        tags: ["logitech", "mouse", "ergonomic", "mx master", "productivity"],
        warranty: "2 Years Official Logitech Warranty",
        ratingAverage: 5.0,
        ratingCount: 41,
        totalSold: 73,
        isFeatured: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p4.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Graphite Gray"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Silver Chrome"].id });

      const vLogi = [
        { title: "Graphite Gray", color: "Graphite Gray", price: 10499, stock: 15, sku: "LOGI-MX3S-GRPH" },
        { title: "Pale Gray / Silver", color: "Silver Chrome", price: 10699, stock: 10, sku: "LOGI-MX3S-PALE" },
      ];

      for (const v of vLogi) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p4.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 12500,
          costPrice: 7800,
          stock: v.stock,
          imageId: img4.useMediaId,
          attributes: { Color: v.color },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 5: Baseus Blade 100W Power Bank (Simple Product with Specifications)
  // ----------------------------------------------------
  if (catPowerbank && sellerProfile1) {
    const img5 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1609592807908-012b1d3ef2ff?w=800",
      "Baseus Blade 100W Power Bank 20000mAh",
      "Slim Baseus blade power bank on desk",
      sellerUser1.id,
      sellerProfile1.id
    );

    let p5 = await db.orm.public.Product.where({ slug: "baseus-blade-100w-power-bank" }).first();
    if (!p5) {
      p5 = await db.orm.public.Product.create({
        name: "Baseus Blade 100W Power Bank 20000mAh Ultra Thin Laptop Fast Charger",
        slug: "baseus-blade-100w-power-bank",
        sku: "BAS-BLADE-100W",
        shortDescription: "Ultra-slim 18mm profile, 100W Power Delivery output capable of charging MacBook Pro, Dell XPS and iPad at full speed.",
        description: "<p>Digital status display shows real-time wattage, voltage, and remaining recharge time. Dual USB-C plus dual USB-A ports charge up to 4 devices simultaneously.</p>",
        categoryId: catPowerbank.id,
        brandId: brandMap["baseus"]?.id ?? null,
        sellerId: sellerProfile1.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.SIMPLE,
        basePrice: 6200.0,
        comparePrice: 7500.0,
        costPrice: 4600.0,
        stock: 35,
        mainImageId: img5.useMediaId,
        tags: ["baseus", "power bank", "100w", "laptop charger", "fast charging"],
        warranty: "6 Months Official Warranty",
        ratingAverage: 4.8,
        ratingCount: 22,
        totalSold: 56,
        isFeatured: true,
      });

      // Simple Product Specifications (isVariation: false)
      const paMat = await db.orm.public.ProductAttribute.create({
        productId: p5.id,
        attributeId: attrMaterial.id,
        isVariation: false,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paMat.id, customValue: "Aircraft Aluminum & ABS Composite" });

      const paConn = await db.orm.public.ProductAttribute.create({
        productId: p5.id,
        attributeId: attrConn.id,
        isVariation: false,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paConn.id, customValue: "Dual USB-C 100W + Dual USB-A 30W" });
    }
  }

  // ----------------------------------------------------
  // PRODUCT 6: Redragon K552 RGB Mechanical Keyboard (Variable, Vendor: ByteTech)
  // ----------------------------------------------------
  if (catComputer && sellerProfile2) {
    const img6 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800",
      "Redragon K552 RGB Mechanical Keyboard",
      "Redragon mechanical keyboard with glowing RGB keys",
      sellerUser2.id,
      sellerProfile2.id
    );

    let p6 = await db.orm.public.Product.where({ slug: "redragon-k552-mechanical-keyboard" }).first();
    if (!p6) {
      p6 = await db.orm.public.Product.create({
        name: "Redragon K552 Kumara RGB Mechanical Gaming Keyboard",
        slug: "redragon-k552-mechanical-keyboard",
        sku: "RED-K552-001",
        shortDescription: "Compact 87-key Tenkeyless (TKL) mechanical keyboard with solid metal-ABS construction and dynamic RGB lighting.",
        description: "<p>Dust-proof mechanical switches for longevity and responsiveness. 100% anti-ghosting full key rollover for competitive esports.</p>",
        categoryId: catComputer.id,
        brandId: brandMap["redragon"]?.id ?? null,
        sellerId: sellerProfile2.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 3250.0,
        comparePrice: 3800.0,
        costPrice: 2200.0,
        stock: 40,
        mainImageId: img6.useMediaId,
        tags: ["redragon", "keyboard", "gaming", "mechanical", "rgb"],
        warranty: "1 Year Official Warranty",
        ratingAverage: 4.6,
        ratingCount: 16,
        totalSold: 47,
      });

      const paSwitch = await db.orm.public.ProductAttribute.create({
        productId: p6.id,
        attributeId: attrSwitch.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paSwitch.id, attributeValueId: switchValMap["Tactile Blue Switch"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paSwitch.id, attributeValueId: switchValMap["Linear Red Switch"].id });

      const vKey = [
        { title: "Outemu Blue Switch / Clicky", sw: "Tactile Blue Switch", price: 3250, stock: 22, sku: "RED-K552-BLU" },
        { title: "Outemu Red Switch / Silent", sw: "Linear Red Switch", price: 3350, stock: 18, sku: "RED-K552-RED" },
      ];

      for (const v of vKey) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p6.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 3800,
          costPrice: 2200,
          stock: v.stock,
          imageId: img6.useMediaId,
          attributes: { "Mechanical Switch": v.sw },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrSwitch.id,
          attributeValueId: switchValMap[v.sw].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 7: Genuine Leather Bi-Fold Wallet (Variable, Vendor: Apparel Studio)
  // ----------------------------------------------------
  if (catLeather && sellerProfile3) {
    const img7 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800",
      "Full Grain Leather Wallet for Men",
      "Folded leather wallet displaying fine stitching",
      sellerUser3.id,
      sellerProfile3.id
    );

    let p7 = await db.orm.public.Product.where({ slug: "genuine-leather-bifold-wallet" }).first();
    if (!p7) {
      p7 = await db.orm.public.Product.create({
        name: "Minimalist Full-Grain Genuine Leather Bi-Fold Wallet for Men",
        slug: "genuine-leather-bifold-wallet",
        sku: "ART-WLT-001",
        shortDescription: "Hand-stitched genuine vegetable tanned cowhide leather with integrated RFID blocking shield.",
        description: "<p>Holds up to 8 cards plus currency notes with a slim silhouette that fits effortlessly into any front or rear pocket.</p>",
        categoryId: catLeather.id,
        brandId: brandMap["artisan-crafts"]?.id ?? null,
        sellerId: sellerProfile3.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 950.0,
        comparePrice: 1350.0,
        costPrice: 480.0,
        stock: 50,
        mainImageId: img7.useMediaId,
        tags: ["leather", "wallet", "rfid", "handmade", "mens accessories"],
        warranty: "2 Years Stitching & Leather Guarantee",
        ratingAverage: 4.9,
        ratingCount: 35,
        totalSold: 92,
        isTrending: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p7.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Antique Brown"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Jet Black"].id });

      const vWlt = [
        { title: "Antique Brown Leather", color: "Antique Brown", price: 950, stock: 30, sku: "ART-WLT-BRN" },
        { title: "Classic Jet Black", color: "Jet Black", price: 950, stock: 20, sku: "ART-WLT-BLK" },
      ];

      for (const v of vWlt) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p7.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 1350,
          costPrice: 480,
          stock: v.stock,
          imageId: img7.useMediaId,
          attributes: { Color: v.color },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 8: JBL Flip 6 Portable Bluetooth Speaker (Variable, Platform-Owned)
  // ----------------------------------------------------
  if (catAudio) {
    const img8 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800",
      "JBL Flip 6 Waterproof Bluetooth Speaker",
      "JBL Flip 6 speaker on table",
      admin.id
    );

    let p8 = await db.orm.public.Product.where({ slug: "jbl-flip-6-portable-speaker" }).first();
    if (!p8) {
      p8 = await db.orm.public.Product.create({
        name: "JBL Flip 6 Portable Waterproof Bluetooth Speaker with Deep Bass",
        slug: "jbl-flip-6-portable-speaker",
        sku: "JBL-FLIP6-001",
        shortDescription: "2-way speaker system delivering loud, crystal clear, and powerful sound with dual passive radiators.",
        description: "<p>IP67 waterproof and dustproof design lets you bring your music anywhere. Up to 12 hours of playtime on a single charge.</p>",
        categoryId: catAudio.id,
        brandId: brandMap["jbl"]?.id ?? null,
        sellerId: null,
        isPlatformOwned: true,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 11800.0,
        comparePrice: 13500.0,
        costPrice: 8900.0,
        stock: 30,
        mainImageId: img8.useMediaId,
        tags: ["jbl", "speaker", "bluetooth", "waterproof", "flip 6"],
        warranty: "1 Year Official Warranty",
        ratingAverage: 4.9,
        ratingCount: 29,
        totalSold: 58,
        isFeatured: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p8.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Jet Black"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Midnight Blue"].id });

      const vJbl = [
        { title: "Midnight Black", color: "Jet Black", price: 11800, stock: 18, sku: "JBL-FLIP6-BLK" },
        { title: "Ocean Blue", color: "Midnight Blue", price: 11950, stock: 12, sku: "JBL-FLIP6-BLU" },
      ];

      for (const v of vJbl) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p8.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: 13500,
          costPrice: 8900,
          stock: v.stock,
          imageId: img8.useMediaId,
          attributes: { Color: v.color },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 9: Samsung Galaxy S24 Ultra 5G (Variable, Vendor: Apex Tech)
  // ----------------------------------------------------
  if (catPhone && sellerProfile1) {
    const img9 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800",
      "Samsung Galaxy S24 Ultra 5G",
      "Titanium Galaxy S24 Ultra with S Pen",
      sellerUser1.id,
      sellerProfile1.id
    );

    let p9 = await db.orm.public.Product.where({ slug: "samsung-galaxy-s24-ultra-5g" }).first();
    if (!p9) {
      p9 = await db.orm.public.Product.create({
        name: "Samsung Galaxy S24 Ultra 5G (Titanium AI Flagship)",
        slug: "samsung-galaxy-s24-ultra-5g",
        sku: "SAM-S24U-001",
        shortDescription: "200MP Quad Telephoto Camera, Snapdragon 8 Gen 3 for Galaxy, Grade 2 Titanium Frame, and Galaxy AI.",
        description: "<p>The apex of smartphone engineering. Circle to Search with Google, Live Call Translation, and Corning Gorilla Armor anti-reflective display.</p>",
        categoryId: catPhone.id,
        brandId: brandMap["samsung"]?.id ?? null,
        sellerId: sellerProfile1.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 148000.0,
        comparePrice: 160000.0,
        costPrice: 135000.0,
        stock: 20,
        mainImageId: img9.useMediaId,
        tags: ["samsung", "flagship", "galaxy ai", "s24 ultra", "5g"],
        warranty: "1 Year Official Brand Warranty",
        ratingAverage: 5.0,
        ratingCount: 18,
        totalSold: 24,
        isFeatured: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p9.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Titanium Black"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Titanium Gray"].id });

      const paStore = await db.orm.public.ProductAttribute.create({
        productId: p9.id,
        attributeId: attrStorage.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStore.id, attributeValueId: storageValMap["256GB"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStore.id, attributeValueId: storageValMap["512GB"].id });

      const vSam = [
        { title: "Titanium Black / 256GB", color: "Titanium Black", storage: "256GB", price: 148000, stock: 10, sku: "SAM-S24U-BLK-256" },
        { title: "Titanium Gray / 256GB", color: "Titanium Gray", storage: "256GB", price: 148000, stock: 6, sku: "SAM-S24U-GRY-256" },
        { title: "Titanium Gray / 512GB", color: "Titanium Gray", storage: "512GB", price: 168000, stock: 4, sku: "SAM-S24U-GRY-512" },
      ];

      for (const v of vSam) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p9.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: v.price + 12000,
          costPrice: v.price - 12000,
          stock: v.stock,
          imageId: img9.useMediaId,
          attributes: { Color: v.color, "Internal Storage": v.storage },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrStorage.id,
          attributeValueId: storageValMap[v.storage].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 10: Xiaomi Robot Vacuum Mop 3C (Simple, Platform-Owned)
  // ----------------------------------------------------
  if (homeCat) {
    const img10 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800",
      "Xiaomi Mijia Smart Robot Vacuum Mop 3C",
      "Smart robot vacuum cleaner with charging base",
      admin.id
    );

    let p10 = await db.orm.public.Product.where({ slug: "xiaomi-mijia-robot-vacuum-mop-3c" }).first();
    if (!p10) {
      p10 = await db.orm.public.Product.create({
        name: "Xiaomi Mijia Smart Robot Vacuum Mop 3C with Laser LiDAR Navigation",
        slug: "xiaomi-mijia-robot-vacuum-mop-3c",
        sku: "MIA-ROBOT-3C",
        shortDescription: "4000Pa powerful cyclone suction, LDS laser navigation, smart water tank, and Mi Home app remote scheduling.",
        description: "<p>Effortlessly sweep and mop your entire apartment. 360-degree scanning creates precise room floor maps to avoid obstacles and clean every corner.</p>",
        categoryId: homeCat.id,
        brandId: brandMap["xiaomi"]?.id ?? null,
        sellerId: null,
        isPlatformOwned: true,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.SIMPLE,
        basePrice: 23500.0,
        comparePrice: 27000.0,
        costPrice: 18500.0,
        stock: 20,
        mainImageId: img10.useMediaId,
        tags: ["xiaomi", "robot vacuum", "cleaner", "smart home", "iot"],
        warranty: "1 Year Service Warranty",
        ratingAverage: 4.9,
        ratingCount: 15,
        totalSold: 32,
      });

      const paConn = await db.orm.public.ProductAttribute.create({
        productId: p10.id,
        attributeId: attrConn.id,
        isVariation: false,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paConn.id, customValue: "Wi-Fi 2.4GHz + Mi Home App" });
    }
  }

  // ----------------------------------------------------
  // PRODUCT 11: Apple iPad 10th Gen 10.9-inch (Variable, Vendor: ByteTech)
  // ----------------------------------------------------
  if (electronics && sellerProfile2) {
    const img11 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800",
      "Apple iPad 10th Gen Liquid Retina",
      "Apple iPad tablet with Apple Pencil",
      sellerUser2.id,
      sellerProfile2.id
    );

    let p11 = await db.orm.public.Product.where({ slug: "apple-ipad-10th-gen-10-9-inch" }).first();
    if (!p11) {
      p11 = await db.orm.public.Product.create({
        name: "Apple iPad 10th Gen 10.9-inch Liquid Retina Display A14 Bionic",
        slug: "apple-ipad-10th-gen-10-9-inch",
        sku: "APL-IPAD10-001",
        shortDescription: "All-screen design with 10.9-inch Liquid Retina display, A14 Bionic chip, and USB-C connectivity.",
        description: "<p>Draw, paint, write and multi-task smoothly with iPadOS. Landscape 12MP Ultra Wide front camera with Center Stage for FaceTime and zoom calls.</p>",
        categoryId: electronics.id,
        brandId: brandMap["apple"]?.id ?? null,
        sellerId: sellerProfile2.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.VARIABLE,
        basePrice: 46500.0,
        comparePrice: 52000.0,
        costPrice: 41000.0,
        stock: 25,
        mainImageId: img11.useMediaId,
        tags: ["apple", "ipad", "tablet", "a14 bionic", "liquid retina"],
        warranty: "1 Year Apple International Official Warranty",
        ratingAverage: 5.0,
        ratingCount: 21,
        totalSold: 44,
        isFeatured: true,
      });

      const paColor = await db.orm.public.ProductAttribute.create({
        productId: p11.id,
        attributeId: attrColor.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Silver Chrome"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paColor.id, attributeValueId: colorValMap["Midnight Blue"].id });

      const paStore = await db.orm.public.ProductAttribute.create({
        productId: p11.id,
        attributeId: attrStorage.id,
        isVariation: true,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStore.id, attributeValueId: storageValMap["64GB"].id });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paStore.id, attributeValueId: storageValMap["256GB"].id });

      const vIpad = [
        { title: "Silver / 64GB Wi-Fi", color: "Silver Chrome", storage: "64GB", price: 46500, stock: 12, sku: "APL-IPAD10-SLV-64" },
        { title: "Blue / 64GB Wi-Fi", color: "Midnight Blue", storage: "64GB", price: 46500, stock: 8, sku: "APL-IPAD10-BLU-64" },
        { title: "Blue / 256GB Wi-Fi", color: "Midnight Blue", storage: "256GB", price: 62500, stock: 5, sku: "APL-IPAD10-BLU-256" },
      ];

      for (const v of vIpad) {
        const variant = await db.orm.public.ProductVariant.create({
          productId: p11.id,
          sku: v.sku,
          title: v.title,
          price: v.price,
          comparePrice: v.price + 5500,
          costPrice: v.price - 5500,
          stock: v.stock,
          imageId: img11.useMediaId,
          attributes: { Color: v.color, "Internal Storage": v.storage },
          isActive: true,
        });

        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrColor.id,
          attributeValueId: colorValMap[v.color].id,
        });
        await db.orm.public.ProductVariantAttributeValue.create({
          variantId: variant.id,
          attributeId: attrStorage.id,
          attributeValueId: storageValMap[v.storage].id,
        });
      }
    }
  }

  // ----------------------------------------------------
  // PRODUCT 12: Ugreen 65W GaN Fast Charger (Simple, Vendor: Apex Tech)
  // ----------------------------------------------------
  if (catPowerbank && sellerProfile1) {
    const img12 = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800",
      "Ugreen 65W GaN 3-Port Fast Charger",
      "Ugreen GaN fast charger plugged in",
      sellerUser1.id,
      sellerProfile1.id
    );

    let p12 = await db.orm.public.Product.where({ slug: "ugreen-65w-gan-fast-charger" }).first();
    if (!p12) {
      p12 = await db.orm.public.Product.create({
        name: "Ugreen Nexode 65W GaN 3-Port Fast Desktop Power Adapter",
        slug: "ugreen-65w-gan-fast-charger",
        sku: "UGR-GAN-65W",
        shortDescription: "Gallium Nitride (GaN) technology charges iPhone, MacBook Air and Galaxy phone concurrently with smart power allocation.",
        description: "<p>Ultra-compact and energy efficient. Foldable US pins with EU/UK adapter support. Overvoltage, overheating, and short-circuit protection built in.</p>",
        categoryId: catPowerbank.id,
        brandId: brandMap["ugreen"]?.id ?? null,
        sellerId: sellerProfile1.id,
        isPlatformOwned: false,
        approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
        status: PRODUCT_STATUS.PUBLISHED,
        productType: PRODUCT_TYPE.SIMPLE,
        basePrice: 2850.0,
        comparePrice: 3400.0,
        costPrice: 1950.0,
        stock: 50,
        mainImageId: img12.useMediaId,
        tags: ["ugreen", "gan", "charger", "65w", "fast charging", "type-c"],
        warranty: "1 Year Official Warranty",
        ratingAverage: 4.9,
        ratingCount: 31,
        totalSold: 84,
      });

      const paMat = await db.orm.public.ProductAttribute.create({
        productId: p12.id,
        attributeId: attrMaterial.id,
        isVariation: false,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paMat.id, customValue: "Fireproof V0 PC Plastic" });

      const paConn = await db.orm.public.ProductAttribute.create({
        productId: p12.id,
        attributeId: attrConn.id,
        isVariation: false,
      });
      await db.orm.public.ProductAttributeValue.create({ productAttributeId: paConn.id, customValue: "2x USB-C (65W Max) + 1x USB-A (22.5W Max)" });
    }
  }

  // Synchronize Categories and Products with their unique UseMedia
  if (electronics) {
    await db.orm.public.Category.where({ id: electronics.id }).update({
      imageId: catElectronicsImg.useMediaId,
    });
  }
  if (fashion) {
    await db.orm.public.Category.where({ id: fashion.id }).update({
      imageId: catFashionImg.useMediaId,
    });
  }

  // ==========================================
  // 7. SEED COUPONS & HERO BANNERS
  // ==========================================
  console.log("🎟️ Seeding Coupons & Platform Banners...");
  let welcomeCoupon = await db.orm.public.Coupon.where({ code: "WELCOME10" }).first();
  if (!welcomeCoupon) {
    await db.orm.public.Coupon.create({
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10.0,
      minOrderAmount: 1000.0,
      maxDiscountAmount: 500.0,
      usageLimit: 500,
      usedCount: 22,
      isActive: true,
    });
  }

  let eidCoupon = await db.orm.public.Coupon.where({ code: "SHOPORA500" }).first();
  if (!eidCoupon) {
    await db.orm.public.Coupon.create({
      code: "SHOPORA500",
      discountType: "FIXED",
      discountValue: 500.0,
      minOrderAmount: 5000.0,
      usageLimit: 200,
      usedCount: 14,
      isActive: true,
    });
  }

  let banner1 = await db.orm.public.Banner.where({ position: "HERO_SLIDER" }).first();
  if (!banner1) {
    const bannerMedia = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600",
      "Smart Sourcing Banner",
      "Hero slider promotional banner",
      admin.id
    );
    await db.orm.public.Banner.create({
      title: "Smart Sourcing & Multi-Vendor Marketplace",
      subtitle: "Discover authentic gadgets, smartwatches, lifestyle apparel and electronics directly from verified sellers.",
      imageId: bannerMedia.useMediaId,
      linkUrl: "/products",
      position: "HERO_SLIDER",
      displayOrder: 1,
      isActive: true,
    });
  }

  // 8. SEED HOMEPAGE HERO SLIDERS (3 Distinct Variants)
  console.log("🎨 Seeding Homepage Hero Sliders (IMAGE_BG_CONTENT, IMAGE_ONLY, CONTENT_ONLY)...");

  // Slider 1: IMAGE_BG_CONTENT (Background image with rich floating overlay content)
  const existingSlider1 = await db.orm.public.Slider.where({ displayOrder: 1 }).first();
  if (!existingSlider1) {
    const slider1Media = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1800&q=85",
      "Sony WH-1000XM5 Studio Wireless",
      "Sony wireless headphone hero background",
      admin.id
    );
    await db.orm.public.Slider.create({
      type: "IMAGE_BG_CONTENT",
      badgeText: "✨ Flagship Audio Drop • 2026",
      title: "Sony WH-1000XM5 Studio Wireless",
      subtitle: "Industry-leading noise cancellation with two processors, 8 microphones, and ultra-comfortable lightweight fit.",
      description: "Experience 30 hours battery life with quick charging, crystal clear hands-free calling, and Multipoint connection.",
      imageId: slider1Media.useMediaId,
      linkUrl: "/products",
      buttonText: "Explore Headphone",
      textColor: "LIGHT",
      displayOrder: 1,
      isActive: true,
    });
  }

  // Slider 2: IMAGE_ONLY (Pure Visual Banner / Creative Poster)
  const existingSlider2 = await db.orm.public.Slider.where({ displayOrder: 2 }).first();
  if (!existingSlider2) {
    const slider2Media = await getOrCreateUseMedia(
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1800&q=85",
      "Official Brand Week Showcase",
      "Brand week showcase promotional poster",
      admin.id
    );
    await db.orm.public.Slider.create({
      type: "IMAGE_ONLY",
      title: "Official Brand Week Showcase",
      imageId: slider2Media.useMediaId,
      linkUrl: "/products",
      displayOrder: 2,
      isActive: true,
    });
  }

  // Slider 3: CONTENT_ONLY (Stylized CSS Gradient Card with Offer Badge, Big Typography & Action)
  const existingSlider3 = await db.orm.public.Slider.where({ displayOrder: 3 }).first();
  if (!existingSlider3) {
    await db.orm.public.Slider.create({
      type: "CONTENT_ONLY",
      badgeText: "🔥 Mega Shopping Fest • 30% OFF",
      title: "Upgrade Your Tech Arsenal for Less",
      subtitle: "Discover high-performance mechanical keyboards, wireless ANC earbuds, smartwatch trackers, and official lifestyle gear.",
      description: "Use voucher code 'SHOPORA2026' for instant ৳500 discount on prepaid orders above ৳3,000. Free express delivery across Bangladesh.",
      bgGradient: "from-blue-600 via-indigo-700 to-purple-800",
      bgColor: "#1e1b4b",
      linkUrl: "/products",
      buttonText: "Claim Voucher & Shop",
      textColor: "LIGHT",
      displayOrder: 3,
      isActive: true,
    });
  }

  console.log("\n=======================================================");
  console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log("✅ 1 Super Admin: admin@shopora.com / Admin@123456");
  console.log("✅ 3 Verified Sellers: Apex Tech, ByteTech Official, Apparel Studio BD");
  console.log("✅ 2 Verified Customers: rahim@shopora.com, sadia.akter@shopora.com");
  console.log("✅ 10+ Categories with full parent-child hierarchy");
  console.log("✅ 13 Official Brands (Kieslect, Anker, Logitech, Baseus, JBL, Samsung, Apple, etc.)");
  console.log("✅ 7 Relational Attributes (Color, Size, Storage, Strap, Switch, Material, Connectivity)");
  console.log("✅ 12 Realistic Hybrid Products with Media, UseMedia, Variants & Reviews");
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.close();
  });

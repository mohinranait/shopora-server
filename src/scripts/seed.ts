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
  console.log("🌱 Starting Shopora Database Seed...");

  // 1. Seed Admin User
  const adminPassword = await hashPassword("Admin@123456");
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
    console.log("✅ Admin user seeded: admin@shopora.com / Admin@123456");
  }

  // 2. Seed Verified Seller User & Store
  const sellerPassword = await hashPassword("Seller@123456");
  let sellerUser = await db.orm.public.User.where({ email: "seller@shopora.com" }).first();

  if (!sellerUser) {
    sellerUser = await db.orm.public.User.create({
      name: "Tanzim Rahman",
      email: "seller@shopora.com",
      password: sellerPassword,
      role: USER_ROLES.SELLER,
      phone: "+8801711000002",
      isVerified: true,
      isActive: true,
    });

    const sellerProfile = await db.orm.public.SellerProfile.create({
      userId: sellerUser.id,
      storeName: "Apex Tech & Gadgets",
      storeSlug: "apex-tech-gadgets",
      storeDescription: "Authorized retailer of genuine mobile phones and premium accessories.",
      phone: "+8801711000002",
      businessAddress: "Bashundhara City Shopping Complex, Level 5, Block B, Dhaka",
      taxNumber: "TIN-98472918",
      nidOrTradeLicense: "TRAD/DSCC/019284/2026",
      status: SELLER_STATUS.APPROVED,
      commissionRate: 8.0, // 8% custom commission
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    });

    await db.orm.public.SellerWallet.create({
      sellerId: sellerProfile.id,
      balance: 15400.0,
      pendingBalance: 2800.0,
      totalWithdrawn: 50000.0,
      totalEarnings: 68200.0,
      totalCommissionPaid: 5930.0,
    });

    console.log("✅ Seller user seeded: seller@shopora.com / Seller@123456");
  }

  // 3. Seed Customer User
  const customerPassword = await hashPassword("Customer@123456");
  let customerUser = await db.orm.public.User.where({ email: "customer@shopora.com" }).first();

  if (!customerUser) {
    customerUser = await db.orm.public.User.create({
      name: "Rahim Chowdhury",
      email: "customer@shopora.com",
      password: customerPassword,
      role: USER_ROLES.CUSTOMER,
      phone: "+8801711000003",
      isVerified: true,
      isActive: true,
    });

    await db.orm.public.Address.create({
      userId: customerUser.id,
      fullName: "Rahim Chowdhury",
      phone: "+8801711000003",
      streetAddress: "House 42, Road 11, Banani",
      city: "Dhaka",
      state: "Dhaka Division",
      postalCode: "1213",
      country: "Bangladesh",
      isDefault: true,
      type: "SHIPPING",
    });

    console.log("✅ Customer user seeded: customer@shopora.com / Customer@123456");
  }

  // 4. Seed Hierarchical Categories
  let electronics = await db.orm.public.Category.where({ slug: "electronics" }).first();
  if (!electronics) {
    electronics = await db.orm.public.Category.create({
      name: "Electronics & Gadgets",
      slug: "electronics",
      description: "Smartphones, Laptops, Audio & Electronics",
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600",
      icon: "laptop",
      displayOrder: 1,
      isActive: true,
    });

    await db.orm.public.Category.create({
      name: "Smartphones & Mobile",
      slug: "smartphones",
      description: "Latest 5G Android & iOS Smartphones",
      parentId: electronics.id,
      displayOrder: 1,
      isActive: true,
    });

    await db.orm.public.Category.create({
      name: "Audio & Headphones",
      slug: "audio-headphones",
      description: "Wireless Earbuds, Headphones & Soundbars",
      parentId: electronics.id,
      displayOrder: 2,
      isActive: true,
    });
  }

  let fashion = await db.orm.public.Category.where({ slug: "fashion" }).first();
  if (!fashion) {
    fashion = await db.orm.public.Category.create({
      name: "Fashion & Apparel",
      slug: "fashion",
      description: "Men and Women Clothing & Accessories",
      image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600",
      icon: "shirt",
      displayOrder: 2,
      isActive: true,
    });

    await db.orm.public.Category.create({
      name: "Men's Clothing",
      slug: "mens-clothing",
      description: "Polo Shirts, T-Shirts, Panjabi & Trousers",
      parentId: fashion.id,
      displayOrder: 1,
      isActive: true,
    });
  }

  // 5. Seed Brands
  let apple = await db.orm.public.Brand.where({ slug: "apple" }).first();
  if (!apple) {
    apple = await db.orm.public.Brand.create({
      name: "Apple",
      slug: "apple",
      description: "Innovative tech gadgets, iPhone, iPad, MacBook",
      website: "https://www.apple.com",
      isActive: true,
    });
  }

  let samsung = await db.orm.public.Brand.where({ slug: "samsung" }).first();
  if (!samsung) {
    samsung = await db.orm.public.Brand.create({
      name: "Samsung",
      slug: "samsung",
      description: "Inspire the world with cutting edge tech",
      website: "https://www.samsung.com",
      isActive: true,
    });
  }

  let shoporaBasics = await db.orm.public.Brand.where({ slug: "shopora-basics" }).first();
  if (!shoporaBasics) {
    shoporaBasics = await db.orm.public.Brand.create({
      name: "Shopora Direct",
      slug: "shopora-basics",
      description: "Official direct brand by Shopora marketplace",
      website: "https://shopora.com",
      isActive: true,
    });
  }

  // 6. Seed Sample Products (Hybrid: Platform vs Seller, Simple vs Variant)
  const mensCat = await db.orm.public.Category.where({ slug: "mens-clothing" }).first();
  const phoneCat = await db.orm.public.Category.where({ slug: "smartphones" }).first();
  const audioCat = await db.orm.public.Category.where({ slug: "audio-headphones" }).first();
  const sellerProf = await db.orm.public.SellerProfile.where({ storeSlug: "apex-tech-gadgets" }).first();

  // 6.1 Platform-Owned Variant Product (Admin Direct)
  let poloProduct = await db.orm.public.Product.where({ slug: "shopora-premium-cotton-polo" }).first();
  if (!poloProduct && mensCat) {
    poloProduct = await db.orm.public.Product.create({
      name: "Shopora Premium Pique Cotton Polo Shirt",
      slug: "shopora-premium-cotton-polo",
      sku: "SHO-POLO-001",
      shortDescription: "Crafted from 100% breathable organic combed cotton with anti-shrink finish.",
      description: `<h3>Elevate Your Daily Style</h3><p>Designed for comfort and effortless elegance. Features genuine mother-of-pearl buttons, ribbed collar, and tailored athletic fit.</p><ul><li>100% Organic Pique Cotton</li><li>Colorfast dyed fabric</li><li>Machine washable</li></ul>`,
      categoryId: mensCat.id,
      brandId: shoporaBasics?.id ?? null,
      sellerId: null, // Platform-owned
      isPlatformOwned: true,
      approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
      status: PRODUCT_STATUS.PUBLISHED,
      productType: PRODUCT_TYPE.VARIABLE,
      basePrice: 1250.0,
      comparePrice: 1600.0,
      costPrice: 650.0,
      stock: 120,
      lowStockThreshold: 10,
      mainImage: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
      tags: ["polo", "mens fashion", "cotton", "shopora direct"],
      warranty: "7 Days replacement warranty",
      ratingAverage: 4.8,
      ratingCount: 15,
      totalSold: 42,
      isFeatured: true,
      isTrending: true,
    });

    // Variants for Polo Shirt
    const variants = [
      { title: "Navy Blue / M", color: "Navy Blue", size: "M", price: 1250, stock: 35, sku: "SHO-POLO-NAVY-M" },
      { title: "Navy Blue / L", color: "Navy Blue", size: "L", price: 1250, stock: 40, sku: "SHO-POLO-NAVY-L" },
      { title: "Jet Black / M", color: "Jet Black", size: "M", price: 1290, stock: 25, sku: "SHO-POLO-BLK-M" },
      { title: "Jet Black / L", color: "Jet Black", size: "L", price: 1290, stock: 20, sku: "SHO-POLO-BLK-L" },
    ];

    for (const v of variants) {
      await db.orm.public.ProductVariant.create({
        productId: poloProduct.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        comparePrice: 1600,
        costPrice: 650,
        stock: v.stock,
        image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
        attributes: { Color: v.color, Size: v.size },
        isActive: true,
      });
    }
    console.log("✅ Seeded Platform Product: Shopora Premium Polo (with 4 variants)");
  }

  // 6.2 Platform-Owned Simple Product
  let earbuds = await db.orm.public.Product.where({ slug: "shopora-pulse-pro-wireless-earbuds" }).first();
  if (!earbuds && audioCat) {
    earbuds = await db.orm.public.Product.create({
      name: "Shopora Pulse Pro ANC Wireless Earbuds",
      slug: "shopora-pulse-pro-wireless-earbuds",
      sku: "SHO-EAR-001",
      shortDescription: "Active Noise Cancellation, 40 hours battery backup, and IPX5 waterproof rating.",
      description: "<p>Experience crystal clear acoustic sound with hybrid active noise cancellation up to 35dB. Bluetooth 5.4 ultra-low latency audio for games and calls.</p>",
      categoryId: audioCat.id,
      brandId: shoporaBasics?.id ?? null,
      sellerId: null,
      isPlatformOwned: true,
      approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
      status: PRODUCT_STATUS.PUBLISHED,
      productType: PRODUCT_TYPE.SIMPLE,
      basePrice: 2850.0,
      comparePrice: 3500.0,
      costPrice: 1400.0,
      stock: 65,
      mainImage: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800",
      tags: ["earbuds", "audio", "anc", "wireless", "bluetooth"],
      warranty: "1 Year Official Warranty",
      ratingAverage: 4.9,
      ratingCount: 28,
      totalSold: 89,
      isFeatured: true,
      isTrending: true,
    });
    console.log("✅ Seeded Platform Simple Product: Shopora Pulse Pro Earbuds");
  }

  // 6.3 Seller-Owned Variable Product (Third-Party Vendor)
  let samsungPhone = await db.orm.public.Product.where({ slug: "samsung-galaxy-s24-ultra-5g" }).first();
  if (!samsungPhone && phoneCat && sellerProf) {
    samsungPhone = await db.orm.public.Product.create({
      name: "Samsung Galaxy S24 Ultra 5G (Galaxy AI)",
      slug: "samsung-galaxy-s24-ultra-5g",
      sku: "SAM-S24U-001",
      shortDescription: "200MP Camera, Snapdragon 8 Gen 3, Titanium frame, and embedded S Pen.",
      description: "<p>The ultimate smartphone with revolutionary Galaxy AI features: Circle to Search, Live Call Translation, and ProVisual Engine.</p>",
      categoryId: phoneCat.id,
      brandId: samsung?.id ?? null,
      sellerId: sellerProf.id, // Vendor Product!
      isPlatformOwned: false,
      approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
      status: PRODUCT_STATUS.PUBLISHED,
      productType: PRODUCT_TYPE.VARIABLE,
      basePrice: 148000.0,
      comparePrice: 160000.0,
      costPrice: 135000.0,
      stock: 18,
      mainImage: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800",
      tags: ["samsung", "flagship", "galaxy ai", "smartphone", "5g"],
      warranty: "1 Year Brand Warranty",
      ratingAverage: 5.0,
      ratingCount: 9,
      totalSold: 12,
      isFeatured: true,
      isTrending: true,
    });

    const phoneVariants = [
      { title: "Titanium Black / 256GB", color: "Titanium Black", storage: "256GB", price: 148000, stock: 10, sku: "SAM-S24U-BLK-256" },
      { title: "Titanium Gray / 512GB", color: "Titanium Gray", storage: "512GB", price: 168000, stock: 8, sku: "SAM-S24U-GRY-512" },
    ];

    for (const v of phoneVariants) {
      await db.orm.public.ProductVariant.create({
        productId: samsungPhone.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        comparePrice: v.price + 12000,
        costPrice: v.price - 12000,
        stock: v.stock,
        image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800",
        attributes: { Color: v.color, Storage: v.storage },
        isActive: true,
      });
    }
    console.log("✅ Seeded Seller Vendor Product: Samsung Galaxy S24 Ultra (with variants)");
  }

  // 7. Seed Marketing Coupons & Banners
  let welcomeCoupon = await db.orm.public.Coupon.where({ code: "WELCOME10" }).first();
  if (!welcomeCoupon) {
    await db.orm.public.Coupon.create({
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10.0, // 10% off
      minOrderAmount: 1000.0,
      maxDiscountAmount: 500.0,
      usageLimit: 500,
      usedCount: 14,
      isActive: true,
    });
    console.log("✅ Seeded Coupon: WELCOME10");
  }

  let heroBanner = await db.orm.public.Banner.where({ position: "HERO_SLIDER" }).first();
  if (!heroBanner) {
    await db.orm.public.Banner.create({
      title: "Mega Festival Sale - Up to 40% Off",
      subtitle: "Shop top electronics, premium fashion, and home essentials with fast nationwide delivery.",
      imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600",
      linkUrl: "/products",
      position: "HERO_SLIDER",
      displayOrder: 1,
      isActive: true,
    });
    console.log("✅ Seeded Promotional Hero Banner");
  }

  console.log("\n🎉 Database Seed Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.close();
  });

# 🛍️ Shopora — Hybrid Multi-Vendor E-Commerce Platform API Documentation

> **Production-Ready Hybrid Multi-Vendor E-Commerce Backend Engine**  
> Built with **Express 5**, **TypeScript**, **PostgreSQL**, **Prisma 8 ORM (Postgres runtime)**, **Zod**, and **Cloudinary**.

---

## 📑 সূচিপত্র (Table of Contents)

1. [প্ল্যাটফর্ম আর্কিটেকচার ও মূল বৈশিষ্ঠ্য (Key Architecture)](#-প্ল্যাটফর্ম-আর্কিটেকচার-ও-মূল-বৈশিষ্ঠ্য)
2. [গুরুত্বপূর্ণ পিএসএ নোট (PSA Notes - Must Read)](#-গুরুত্বপূর্ণ-পিএসএ-নোট-psa-notes---must-read)
3. [গ্লোবাল রিকোয়েস্ট ও রেসপন্স ফরম্যাট (Global Envelope)](#-গ্লোবাল-রিকোয়েস্ট-ও-রেসপন্স-ফরম্যাট)
4. [গ্রুপভিত্তিক এপিআই রেফারেন্স (Group-Wise API Endpoints)](#-গ্রুপভিত্তিক-এপিআই-রেফারেন্স)
   - [Group 1: Authentication & Authorization (`/auth`)](#group-1-authentication--authorization-apiauth)
   - [Group 2: User Profile & Addresses (`/users`)](#group-2-user-profile--addresses-apiusers)
   - [Group 3: Cloudinary Media & Media Library (`/media`)](#group-3-cloudinary-media--media-library-apimedia)
   - [Group 4: Categories Catalog (`/categories`)](#group-4-categories-catalog-apicategories)
   - [Group 5: Brands Catalog (`/brands`)](#group-5-brands-catalog-apibrands)
   - [Group 6: Products & Variants (`/products`)](#group-6-products--variants-apiproducts)
   - [Group 7: Multi-Vendor Seller System (`/sellers`)](#group-7-multi-vendor-seller-system-apisellers)
   - [Group 8: Cart Management (`/cart`)](#group-8-cart-management-apicart)
   - [Group 9: Wishlist Management (`/wishlist`)](#group-9-wishlist-management-apiwishlist)
   - [Group 10: Orders & Multi-Vendor Fulfillment (`/orders`)](#group-10-orders--multi-vendor-fulfillment-apiorders)
   - [Group 11: Product Reviews (`/reviews`)](#group-11-product-reviews-apireviews)
   - [Group 12: Marketing, Coupons & Banners (`/marketing`)](#group-12-marketing-coupons--banners-apimarketing)
   - [Group 13: Seller Wallets & Payouts (`/payouts`)](#group-13-seller-wallets--payouts-apipayouts)
   - [Group 14: Order Returns & Refunds (`/returns`)](#group-14-order-returns--refunds-apireturns)
   - [Group 15: Analytics & Intelligence (`/analytics`)](#group-15-analytics--intelligence-apianalytics)
   - [Group 16: Website & Platform Settings (`/settings`)](#group-16-website--platform-settings-apisettings)
   - [Group 17: Dynamic Attributes & Variant Combinations (`/attributes`)](#group-17-dynamic-attributes--variant-combinations-apiattributes)
5. [সার্ভার সেটআপ ও রান করার নির্দেশিকা (Setup Guide)](#-সার্ভার-সেটআপ-ও-রান-করার-নির্দেশিকা)

---

## 🏛️ প্ল্যাটফর্ম আর্কিটেকচার ও মূল বৈশিষ্ঠ্য

Shopora হলো একটি এন্টারপ্রাইজ গ্রেড **Hybrid Multi-Vendor** ই-কমার্স ব্যাকএন্ড:
- **হাইব্রিড মডেল (Hybrid Model)**: অ্যাডমিন নিজস্ব প্ল্যাটফর্ম পণ্য বিক্রি করতে পারে (`isPlatformOwned: true`), পাশাপাশি থার্ড-পার্টি ভেন্ডর/সেলাররা রেজিস্ট্রেশন করে তাদের পণ্য বিক্রি করতে পারে।
- **ভেন্ডর ভেরিফিকেশন ও পণ্য অনুমোদন**: সেলারদের আবেদন অ্যাডমিন যাচাই করে অনুমোদন (`APPROVED`) করে। সেলারদের আপলোড করা পণ্য অ্যাডমিনের রিভিউ ছাড়া গ্রাহকদের নিকট প্রদর্শিত হয় না।
- **অর্ডার স্প্লিটিং ও আর্থিক হিসাব (Order Splitting & Accounting)**: একজন গ্রাহক বিভিন্ন সেলারের পণ্য একত্রে অর্ডার করলে সিস্টেম স্বয়ংক্রিয়ভাবে মূল `Order`-এর অধীনে প্রতিটি সেলারের জন্য আলাদা `SubOrder` তৈরি করে এবং প্ল্যাটফর্ম কমিশন কেটে অবশিষ্ট টাকা সেলারের ওয়ালেটে যোগ করে।
- **ভ্যারিয়েন্ট প্রডাক্ট ইঞ্জিন (Variant Products)**: সিম্পল প্রডাক্ট এবং বিভিন্ন অ্যাট্রিবিউট (Color, Size, RAM ইত্যাদি) যুক্ত ডায়নামিক ভ্যারিয়েন্ট প্রডাক্ট সাপোর্ট করে।
- **ক্লাউডিনারি ডুয়াল-মডেল মিডিয়া পাইপলাইন**: র' ইমেজ মেটাডাটা `Media` টেবিলে থাকে এবং এসইও `alt` ও `description`-সহ কনফিগার করা ইমেজ `UseMedia` মডেলে থাকে।

---

## 📢 গুরুত্বপূর্ণ পিএসএ নোট (PSA Notes - Must Read)

> [!IMPORTANT]
> **PSA Note 1 — Authentication Header:**  
> সুরক্ষিত (Protected) এন্ডপয়েন্টগুলোতে রিকোয়েস্ট পাঠানোর সময় অবশ্যই HTTP Header-এ Bearer Token পাঠাতে হবে:  
> `Authorization: Bearer <your_access_token>`

> [!NOTE]
> **PSA Note 2 — Multi-Vendor Order Splitting:**  
> যখন একজন কাস্টমার চেকআউট করে, ব্যাকএন্ড স্বয়ংক্রিয়ভাবে আইটেমগুলোকে `sellerId` অনুসারে গ্রুপ করে এবং পৃথক `SubOrder` তৈরি করে। প্রতিটি `SubOrder`-এ প্ল্যাটফর্ম কমিশন (`commissionAmount`) ও সেলারের পাওনা (`sellerPayable`) ক্যালকুলেট করা হয়।

> [!TIP]
> **PSA Note 3 — Media & UseMedia Architecture:**  
> ১. যেকোনো ছবি প্রথমে `/api/v1/media/upload` দিয়ে Cloudinary-তে আপলোড করা হয় এবং `Media` টেবিলে আইডি পায়।  
> ২. ইউজার যখন লাইব্রেরি থেকে ইমেজ সিলেক্ট করে তখন `mediaId`, `alt`, ও `description` দিয়ে `/api/v1/media/use-media` কল করে `UseMedia` রেকর্ড তৈরি হয়।  
> ৩. প্রডাক্ট (`mainImageUseMediaId`), ব্র্যান্ড (`useMediaId`), ক্যাটাগরি (`useMediaId`) অথবা ব্যানারে শুধুমাত্র `useMediaId` রেফারেন্স করা হয়।

> [!WARNING]
> **PSA Note 4 — Express 5 Query/Params Immutability:**  
> Express 5-এ `req.query` অবজেক্টের সরাসরি রিঅ্যাস্যাইনমেন্ট নিষিদ্ধ। সকল ইনপুট স্যানিটাইজেশন Zod স্কিমার মাধ্যমে বডিতে সংরক্ষিত হয়।

---

## 🌐 গ্লোবাল রিকোয়েস্ট ও রেসপন্স ফরম্যাট

### Base URL
```
http://localhost:5000/api/v1
```

### Standard Success Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPage": 5
  },
  "data": { ... }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    {
      "path": "email",
      "message": "Please enter a valid email address"
    }
  ],
  "stack": "..." // Only present in development mode
}
```

---

## 📦 গ্রুপভিত্তিক এপিআই রেফারেন্স

---

### Group 1: Authentication & Authorization (`/api/v1/auth`)

গ্রাহক, সেলার এবং অ্যাডমিনের রেজিস্ট্রেশন, লগইন এবং সিকিউরিটি টোকেন হ্যান্ডলিং।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `POST` | `/auth/register/customer` | Public | সাধারণ গ্রাহক হিসেবে নতুন অ্যাকাউন্ট তৈরি করা |
| `POST` | `/auth/register/seller` | Public | নতুন ভেন্ডর/সেলার রেজিস্ট্রেশন ও স্টোর প্রোফাইল তৈরি |
| `POST` | `/auth/login` | Public | ইমেইল ও পাসওয়ার্ড দিয়ে লগইন ও JWT টোকেন গ্রহণ |
| `POST` | `/auth/refresh-token` | Public | রিফ্রেশ টোকেন পাঠিয়ে নতুন অ্যাক্সেস টোকেন নেওয়া |
| `GET` | `/auth/me` | Authenticated | বর্তমানে লগইন করা ইউজারের বিস্তারিত প্রোফাইল ও ভূমিকা দেখা |
| `POST` | `/auth/change-password` | Authenticated | পুরাতন পাসওয়ার্ড পরিবর্তন করে নতুন পাসওয়ার্ড সেট করা |

<details>
<summary>🔍 <b>Auth Payload Examples (ক্লিক করে দেখুন)</b></summary>

#### Register Customer Body:
```json
{
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "password": "Password123!",
  "phone": "01711000000"
}
```

#### Register Seller Body:
```json
{
  "name": "Karim Enterprise",
  "email": "karim@shopora.com",
  "password": "Password123!",
  "storeName": "Karim Tech Shop",
  "phone": "01811000000",
  "businessAddress": "Gulshan-1, Dhaka"
}
```

#### Login Body:
```json
{
  "email": "rahim@example.com",
  "password": "Password123!"
}
```
</details>

---

### Group 2: User Profile & Addresses (`/api/v1/users`)

ইউজার প্রোফাইল এবং একাধিক ডেলিভারি/শিপিং অ্যাড্রেস ম্যানেজমেন্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `PATCH` | `/users/profile` | Authenticated | প্রোফাইল তথ্য (নাম, ফোন, avatarUseMediaId) আপডেট |
| `GET` | `/users/addresses` | Authenticated | নিজের সংরক্ষিত সকল শিপিং/বিলিং অ্যাড্রেস তালিকা |
| `POST` | `/users/addresses` | Authenticated | নতুন শিপিং/বিলিং অ্যাড্রেস যুক্ত করা |
| `DELETE` | `/users/addresses/:id` | Authenticated | সংরক্ষিত একটি অ্যাড্রেস ডিলিট করা |
| `GET` | `/users/admin/all` | Admin | অ্যাডমিন কর্তৃক সব ইউজারের তালিকা দেখা ও ফিল্টারিং |
| `PATCH` | `/users/admin/:id/status` | Admin | ইউজারের অ্যাকাউন্ট সক্রিয় বা নিষ্ক্রিয় (`isActive`) করা |

---

### Group 3: Cloudinary Media & Media Library (`/api/v1/media`)

ছবি Cloudinary-তে আপলোড, মিডিয়া গ্যালারি ব্রাউজিং এবং এসইও মেটাডাটা-সহ `UseMedia` কনফিগারেশন।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `POST` | `/media/upload` | All Users | একক ইমেজ Cloudinary-তে আপলোড করে `Media` মডেলে সংরক্ষণ |
| `POST` | `/media/upload-multiple` | Admin, Seller | একসাথে সর্বোচ্চ ১০টি ছবি আপলোড করে মিডিয়া লাইব্রেরিতে রাখা |
| `POST` | `/media/upload-and-use` | All Users | এক রিকোয়েস্টে আপলোড এবং `alt` / `description` দিয়ে সরাসরি `UseMedia` তৈরি |
| `GET` | `/media` | All Users | নিজের আপলোড করা মিডিয়া লাইব্রেরির তালিকা (প্যাজিনেশনসহ) |
| `GET` | `/media/:id` | All Users | নির্দিষ্ট র' মিডিয়া অ্যাসেট ভিউ |
| `DELETE` | `/media/:id` | Admin, Seller | Cloudinary স্টোরেজ এবং লাইব্রেরি থেকে ইমেজ ডিলিট করা |
| `POST` | `/media/use-media` | All Users | লাইব্রেরি থেকে `mediaId` সিলেক্ট করে `alt` ও `description` দিয়ে `UseMedia` তৈরি |
| `GET` | `/media/use-media` | All Users | নিজের কনফিগার করা `UseMedia` লিস্ট দেখা |
| `GET` | `/media/use-media/:id` | All Users | নির্দিষ্ট `UseMedia` রেকর্ড বিস্তারিত দেখা |
| `PATCH` | `/media/use-media/:id` | All Users | `UseMedia`-এর এসইও `alt` বা `description` আপডেট |
| `DELETE` | `/media/use-media/:id` | All Users | `UseMedia` কনফিগারেশন মুছে ফেলা |

<details>
<summary>🔍 <b>Media Selection & UseMedia Payload:</b></summary>

```json
// POST /api/v1/media/use-media
{
  "mediaId": 12,
  "alt": "Smart Men Chronograph Watch Black Leather Strap",
  "description": "High resolution front view of luxury chronograph watch"
}
```
</details>

---

### Group 4: Categories Catalog (`/api/v1/categories`)

বহুস্তরীয় (Hierarchical Parent-Child) ক্যাটাগরি ম্যানেজমেন্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/categories` | Public | ট্রি আকারে সকল প্যারেন্ট ও সাব-ক্যাটাগরি রিট্রিভ করা |
| `GET` | `/categories/all` | Public | ড্রপডাউন ও টেবিলের জন্য ফ্ল্যাট ক্যাটাগরি লিস্ট |
| `GET` | `/categories/:slug` | Public | নির্দিষ্ট ক্যাটাগরির বিস্তারিত, প্যারেন্ট ও চিলড্রেন দেখা |
| `POST` | `/categories` | Admin | নতুন ক্যাটাগরি তৈরি (`useMediaId` সাপোর্টসহ) |
| `PATCH` | `/categories/:id` | Admin | ক্যাটাগরির নাম, ইমেজ বা প্যারেন্ট আপডেট |
| `DELETE` | `/categories/:id` | Admin | ক্যাটাগরি ডিলিট করা (পণ্য যুক্ত থাকলে ব্লক করবে) |

---

### Group 5: Brands Catalog (`/api/v1/brands`)

ব্র্যান্ড ম্যানেজমেন্ট এবং ব্র্যান্ডভিত্তিক পণ্য উপস্থাপন।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/brands` | Public | সক্রিয় সকল ব্র্যান্ডের বর্ণনাসহ তালিকা |
| `GET` | `/brands/:slug` | Public | নির্দিষ্ট ব্র্যান্ডের বিস্তারিত তথ্য ও লোগো |
| `POST` | `/brands` | Admin | নতুন ব্র্যান্ড যুক্ত করা (`useMediaId` সাপোর্টসহ) |
| `PATCH` | `/brands/:id` | Admin | ব্র্যান্ডের নাম, লোগো, ওয়েবসাইট বা স্ট্যাটাস আপডেট |
| `DELETE` | `/brands/:id` | Admin | ব্র্যান্ড ডিলিট করা |

---

### Group 6: Products & Variants (`/api/v1/products`)

সিম্পল ও ভ্যারিয়েন্ট প্রডাক্ট ম্যানেজমেন্ট, লাইব্রেরি ইমেজ লিংকিং এবং অ্যাডমিন অ্যাপ্রুভাল সিস্টেম।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/products` | Public | পণ্য ফিল্টারিং, সার্চ, ক্যাটাগরি/ব্র্যান্ড/মূল্য ফিল্টার, সর্টিং |
| `GET` | `/products/detail/:slug` | Public | পণ্যের বিস্তারিত, মূল ছবি, গ্যালারি, ভ্যারিয়েন্ট ও রিভিউ |
| `GET` | `/products/seller/my-products`| Seller | সেলারের নিজস্ব পণ্যের তালিকা ও অনুমোদন স্ট্যাটাস |
| `GET` | `/products/admin/all` | Admin | অ্যাডমিন কর্তৃক সব পণ্য মনিটরিং |
| `POST` | `/products` | Admin, Seller | নতুন পণ্য তৈরি (অ্যাডমিন পণ্য স্বয়ংক্রিয় অনুমোদিত, সেলার পণ্য পেন্ডিং) |
| `PATCH` | `/products/:id` | Admin, Seller | পণ্যের বিবরণ, স্টক, মূল্য, ভ্যারিয়েন্ট ও ছবি আপডেট |
| `PATCH` | `/products/admin/:id/approval`| Admin | সেলার পণ্যের অনুমোদন (`APPROVED`) বা প্রত্যাখ্যান (`REJECTED`) |
| `DELETE` | `/products/:id` | Admin, Seller | পণ্য ডিলিট বা আর্কাইভ করা |

<details>
<summary>🔍 <b>Product Creation Payload (Variable Variant Product with Dynamic Attributes):</b></summary>

```json
// POST /api/v1/products
{
  "name": "Men Premium Slim-Fit Casual Cotton Shirt",
  "shortDescription": "100% breathable organic cotton slim-fit shirt",
  "description": "Full detailed description of the cotton shirt with detailed size chart...",
  "categoryId": 3,
  "brandId": 1,
  "productType": "VARIABLE", // "SIMPLE" | "VARIABLE"
  "basePrice": 1250.00,
  "comparePrice": 1600.00,
  "costPrice": 850.00,
  "mainImageUseMediaId": 45, // UseMedia model reference
  "images": [
    { "useMediaId": 46, "displayOrder": 1, "isPrimary": true },
    { "useMediaId": 47, "displayOrder": 2 }
  ],
  // ডায়নামিক সিলেক্টেড অ্যাট্রিবিউটস (isVariation: true ভ্যারিয়েন্ট তৈরির জন্য)
  "selectedAttributes": [
    {
      "attributeId": 1, // Color
      "isVariation": true,
      "values": [1, 2] // AttributeValue IDs (1: Red, 2: Blue)
    },
    {
      "attributeId": 2, // Size
      "isVariation": true,
      "values": [3, 4] // AttributeValue IDs (3: M, 4: L)
    }
  ],
  // ভ্যারিয়েন্ট কম্বিনেশন রো (যা Generate বাটন থেকে পাওয়া যায়)
  "variants": [
    {
      "title": "Red / M",
      "sku": "SHIRT-RED-M",
      "price": 1250.00,
      "stock": 25,
      "lowStockThreshold": 5,
      "useMediaId": 48,
      "attributeValueIds": [1, 3], // Relational Foreign Keys
      "attributes": { "Color": "Red", "Size": "M" },
      "weightKg": 0.25,
      "dimensions": { "length": 30, "width": 20, "height": 3 }
    },
    {
      "title": "Red / L",
      "sku": "SHIRT-RED-L",
      "price": 1250.00,
      "stock": 20,
      "lowStockThreshold": 5,
      "useMediaId": 48,
      "attributeValueIds": [1, 4],
      "attributes": { "Color": "Red", "Size": "L" }
    },
    {
      "title": "Blue / M",
      "sku": "SHIRT-BLU-M",
      "price": 1250.00,
      "stock": 30,
      "attributeValueIds": [2, 3],
      "attributes": { "Color": "Blue", "Size": "M" }
    },
    {
      "title": "Blue / L",
      "sku": "SHIRT-BLU-L",
      "price": 1250.00,
      "stock": 15,
      "attributeValueIds": [2, 4],
      "attributes": { "Color": "Blue", "Size": "L" }
    }
  ],
  "videoUrl": "https://www.youtube.com/watch?v=example",
  "trackStock": true,
  "isFreeShipping": false,
  "tags": ["cotton", "shirt", "casual", "slim-fit"],
  "warranty": "7 Days Replacement Warranty"
}
```
</details>

<details>
<summary>🔍 <b>Simple Product with Specification Attributes (Non-Variant):</b></summary>

```json
// POST /api/v1/products (Simple Product with Specifications)
{
  "name": "Wireless Ergonomic Mouse",
  "description": "Silent click optical mouse with 2.4GHz wireless receiver",
  "categoryId": 5,
  "productType": "SIMPLE",
  "basePrice": 850.00,
  "stock": 100,
  "mainImageUseMediaId": 52,
  // নন-ভ্যারিয়েন্ট পণ্যও স্পেসিফিকেশন অ্যাট্রিবিউট ব্যবহার করতে পারে (isVariation: false)
  "selectedAttributes": [
    {
      "attributeId": 5, // Material
      "isVariation": false,
      "values": ["ABS Plastic"] // কাস্টম ভ্যালু অথবা AttributeValue ID
    },
    {
      "attributeId": 6, // Connectivity
      "isVariation": false,
      "values": ["2.4GHz Wireless"]
    }
  ]
}
```
</details>

---

### Group 7: Multi-Vendor Seller System (`/api/v1/sellers`)

সেলার স্টোরফ্রন্ট, সেলার ড্যাশবোর্ড স্ট্যাটস ও অ্যাডমিন ভেরিফিকেশন।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/sellers/store/:slug` | Public | গ্রাহকদের জন্য পাবলিক ভেন্ডর স্টোরফ্রন্ট ও পণ্যের ডিসপ্লে |
| `GET` | `/sellers/me/dashboard` | Seller | সেলার ড্যাশবোর্ড মেট্রিক্স (বিক্রি, পেন্ডিং অর্ডার, ওয়ালেট ব্যালেন্স) |
| `PATCH` | `/sellers/me/profile` | Seller | স্টোরের ব্যানার, লোগো, ব্যাংক অ্যাকাউন্ট, বিকাশ/নগদ আপডেট |
| `GET` | `/sellers/admin/all` | Admin | প্ল্যাটফর্মের সকল সেলারের তালিকা ও অ্যাপ্লিকেশন পর্যালোচনা |
| `PATCH` | `/sellers/admin/:id/review` | Admin | সেলার অনুমোদন (`APPROVED`), কমিশন রেট নির্ধারণ বা সাসপেন্ড |

---

### Group 8: Cart Management (`/api/v1/cart`)

গেস্ট এবং লগইনকৃত উভয় ব্যবহারকারীর জন্য রিয়েল-টাইম শপিং কার্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/cart` | Public/Auth | বর্তমান কার্টের আইটেম, সাবটোটাল ও সেলারভিত্তিক বিবরণ |
| `POST` | `/cart/add` | Public/Auth | কার্টে নির্দিষ্ট পণ্য বা ভ্যারিয়েন্ট যোগ করা |
| `PATCH` | `/cart/item/:id` | Public/Auth | কার্ট আইটেমের পরিমাণ (Quantity) পরিবর্তন |
| `DELETE` | `/cart/item/:id` | Public/Auth | কার্ট থেকে একটি পণ্য বাদ দেওয়া |
| `DELETE` | `/cart/clear` | Public/Auth | পুরো কার্ট খালি করা |

---

### Group 9: Wishlist Management (`/api/v1/wishlist`)

পছন্দের পণ্য সংরক্ষণ ও উইশলিস্ট ম্যানেজমেন্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/wishlist` | Authenticated | লগইনকৃত ইউজারের সকল উইশলিস্ট আইটেম দেখা |
| `POST` | `/wishlist/toggle` | Authenticated | পণ্যের আইডিতে টগল (না থাকলে যুক্ত, থাকলে বাদ দেওয়া) |
| `DELETE` | `/wishlist/:productId` | Authenticated | উইশলিস্ট থেকে পণ্য নির্দিষ্টভাবে মুছে ফেলা |

---

### Group 10: Orders & Multi-Vendor Fulfillment (`/api/v1/orders`)

অর্ডার প্লেসমেন্ট, মাল্টি-ভেন্ডর অর্ডার স্প্লিটিং, ট্র্যাকিং এবং ডেলিভারি লাইফসাইকেল।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `POST` | `/orders/checkout` | Public/Auth | কার্ট চেকআউট ও অর্ডার প্লেসমেন্ট (অটো সাব-অর্ডার স্প্লিটসহ) |
| `GET` | `/orders/my-orders` | Authenticated | গ্রাহকের নিজের পূর্ববর্তী সকল অর্ডারের তালিকা ও ট্র্যাকিং |
| `GET` | `/orders/detail/:id` | Public/Auth | একটি নির্দিষ্ট অর্ডারের সম্পূর্ণ বিবরণ |
| `GET` | `/orders/seller/my-suborders`| Seller | সেলার কর্তৃক তার নিজস্ব সাব-অর্ডারগুলো দেখা |
| `PATCH` | `/orders/seller/suborder/:id/status`| Seller, Admin| সাব-অর্ডারের স্ট্যাটাস পরিবর্তন (`PROCESSING`, `SHIPPED`, `DELIVERED`)|
| `GET` | `/orders/admin/all` | Admin | প্ল্যাটফর্মের সকল মূল অর্ডার পর্যবেক্ষণ |
| `PATCH` | `/orders/admin/:id/payment`| Admin | পেমেন্ট স্ট্যাটাস ম্যানুয়ালি আপডেট করা (`PAID`, `REFUNDED`) |

<details>
<summary>🔍 <b>Checkout Payload Example:</b></summary>

```json
// POST /api/v1/orders/checkout
{
  "customerName": "Sadik Hasan",
  "customerEmail": "sadik@example.com",
  "customerPhone": "01700112233",
  "shippingAddress": {
    "fullName": "Sadik Hasan",
    "phone": "01700112233",
    "streetAddress": "House 12, Road 4, Sector 7",
    "city": "Uttara, Dhaka",
    "country": "Bangladesh"
  },
  "paymentMethod": "COD", // "COD" | "BKASH" | "NAGAD" | "CARD"
  "couponCode": "SUMMER20",
  "orderNotes": "Please deliver after 3 PM"
}
```
</details>

---

### Group 11: Product Reviews (`/api/v1/reviews`)

পণ্য রিভিউ এবং স্টার রেটিং (১-৫ স্টার)।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/reviews/product/:productId` | Public | পণ্যের অনুমোদিত সকল রিভিউ ও গড় রেটিং দেখা |
| `POST` | `/reviews` | Authenticated | পণ্যের জন্য রিভিউ ও মন্তব্য জমা দেওয়া |
| `PATCH` | `/reviews/admin/:id/moderate` | Admin | স্প্যাম রিভিউ মোডারেশন বা অনুমোদন নিয়ন্ত্রণ |

---

### Group 12: Marketing, Coupons & Banners (`/api/v1/marketing`)

ডিসকাউন্ট কুপন ও ডায়নামিক ওয়েবসাইট ব্যানার ম্যানেজমেন্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `POST` | `/marketing/coupons/validate` | Public | কুপন কোডের বৈধতা এবং ডিসকাউন্ট পরিমাণ যাচাই |
| `GET` | `/marketing/coupons/admin/all` | Admin | প্ল্যাটফর্মের সকল কুপন কোডের তালিকা |
| `POST` | `/marketing/coupons/admin` | Admin | নতুন শতাংশ বা ফিক্সড ডিসকাউন্ট কুপন তৈরি |
| `DELETE` | `/marketing/coupons/admin/:id`| Admin | কুপন মুছে ফেলা |
| `GET` | `/marketing/banners` | Public | হোমপেজের হিরো স্লাইডার, প্রোমো গ্রিড ও পপআপ ব্যানার |
| `GET` | `/marketing/banners/admin/all` | Admin | অ্যাডমিন কর্তৃক সব ব্যানারের তালিকা দেখা |
| `POST` | `/marketing/banners/admin` | Admin | নতুন ব্যানার তৈরি (`useMediaId` সাপোর্টসহ) |
| `DELETE` | `/marketing/banners/admin/:id` | Admin | ব্যানার ডিলিট করা |

---

### Group 13: Seller Wallets & Payouts (`/api/v1/payouts`)

সেলার ওয়ালেট ব্যালেন্স, কমিশন হিসেব এবং উত্তোলন (Withdrawal) ম্যানেজমেন্ট।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/payouts/wallet` | Seller | সেলারের বর্তমান ওয়ালেট ব্যালেন্স, পেন্ডিং ও মোট আয় দেখা |
| `POST` | `/payouts/request` | Seller | ব্যাংক/বিকাশ/নগদ-এ টাকা উত্তোলনের (Payout) রিকোয়েস্ট দেওয়া |
| `GET` | `/payouts/admin/all` | Admin | সকল সেলারের পে-আউট রিকোয়েস্টের তালিকা |
| `PATCH` | `/payouts/admin/:id/process` | Admin | পে-আউট অনুমোদন (`APPROVED`), ট্রানজেকশন আইডি সেট ও সম্পন্ন করা |

---

### Group 14: Order Returns & Refunds (`/api/v1/returns`)

পণ্য ফেরত (Return) এবং রিফান্ড প্রসেসিং।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `POST` | `/returns` | Authenticated | ডেলিভারিকৃত অর্ডারের জন্য রিটার্ন রিকোয়েস্ট তৈরি |
| `GET` | `/returns/my-returns` | Authenticated | গ্রাহকের নিজের রিটার্ন আবেদনের অগ্রগতি পর্যবেক্ষণ |
| `GET` | `/returns/admin/all` | Admin | প্ল্যাটফর্মের সব রিটার্ন রিকোয়েস্ট মনিটরিং |
| `PATCH` | `/returns/admin/:id/review` | Admin | রিটার্ন অনুমোদন বা প্রত্যাখ্যান এবং রিফান্ড প্রসেস |

---

### Group 15: Analytics & Intelligence (`/api/v1/analytics`)

প্ল্যাটফর্মের সামগ্রিক পারফরম্যান্স ও সেলস অ্যানালিটিক্স।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/analytics/admin` | Admin | মোট সেলস (GMV), নেট রেভিনিউ, কমিশন আয়, শীর্ষ বিক্রিত পণ্য ও মেট্রিক্স |

---

### Group 16: Website & Platform Settings (`/api/v1/settings`)

ওয়েবসাইট নাম, মুদ্রা, গ্লোবাল কমিশন রেট, শিপিং চার্জ ইত্যাদি ডায়নামিক কনফিগারেশন।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/settings` | Public | ওয়েবসাইটের পাবলিক ডায়নামিক কনফিগারেশন রিড করা |
| `PATCH` | `/settings` | Admin | অ্যাডমিন কর্তৃক কমিশন, শিপিং চার্জ বা পলিসি সেটিংস আপডেট |

---

### Group 17: Dynamic Attributes & Variant Combinations (`/api/v1/attributes`)

সম্পূর্ণ ডায়নামিক অ্যাট্রিবিউট (Color, Size, Material, RAM ইত্যাদি) ও ভ্যালু ম্যানেজমেন্ট এবং UI-এর জন্য স্বয়ংক্রিয় কার্টেশিয়ান গুণফল ভ্যারিয়েন্ট জেনারেটর (UI Generate Button Engine)।

| Method | Endpoint | Access / Role | বিবরণ (Description) |
|---|---|---|---|
| `GET` | `/attributes` | Public | সক্রিয় সকল অ্যাট্রিবিউট ও তাদের ভ্যালুসমূহের তালিকা রিট্রিভ করা |
| `GET` | `/attributes/:id` | Public | নির্দিষ্ট অ্যাট্রিবিউট ও তার অধীনস্থ সকল ভ্যালু রিট্রিভ করা |
| `POST` | `/attributes` | Admin, Seller | নতুন অ্যাট্রিবিউট তৈরি (`name`, `slug`, `type`: "SELECT" \| "COLOR" \| "BUTTON" \| "RADIO" \| "TEXT", `description`, `displayOrder`) |
| `PATCH` | `/attributes/:id` | Admin, Seller | অ্যাট্রিবিউট তথ্য আপডেট করা |
| `DELETE` | `/attributes/:id` | Admin | অ্যাট্রিবিউট মুছে ফেলা (ক্যাসকেডভাবে এর ভ্যালুগুলোও ক্লিন হবে) |
| `POST` | `/attributes/:id/values` | Admin, Seller | নির্দিষ্ট অ্যাট্রিবিউটে নতুন ভ্যালু যোগ করা (`value`, `colorCode`, `displayOrder`) |
| `DELETE` | `/attributes/values/:valueId` | Admin | কোনো অ্যাট্রিবিউট ভ্যালু মুছে ফেলা |
| `POST` | `/attributes/generate-combinations` | Authenticated | **UI Generate Button API**: সিলেক্টেড অ্যাট্রিবিউট ও ভ্যালু প্রদান করলে স্বয়ংক্রিয়ভাবে কার্টেশিয়ান গুণফল তৈরি করে ভ্যারিয়েন্ট রো রিটার্ন করে |

<details>
<summary>🔍 <b>Variant Combination Generator Flow (UI "Generate" Button Concept):</b></summary>

**UI তে যেভাবে কাজ করবে:**
1. মার্চেন্ট/সেলার ড্রপডাউন থেকে প্রথম অ্যাট্রিবিউট সিলেক্ট করবে (যেমন: `Color`) এবং এর ভ্যালুগুলো সিলেক্ট করবে (যেমন: `Red`, `Blue`)।
2. এরপর আরেকটি অ্যাট্রিবিউট সিলেক্ট করবে (যেমন: `Size`) এবং এর ভ্যালুগুলো সিলেক্ট করবে (যেমন: `M`, `L`, `XL`)।
3. UI-তে **"Generate"** বাটনে ক্লিক করলে ফ্রন্টএন্ড থেকে নিচের রিকোয়েস্ট পাঠানো হবে:

```json
// POST /api/v1/attributes/generate-combinations
{
  "selectedAttributes": [
    {
      "attributeId": 1, // Color
      "valueIds": [1, 2] // 1: Red, 2: Blue
    },
    {
      "attributeId": 2, // Size
      "valueIds": [3, 4, 5] // 3: M, 4: L, 5: XL
    }
  ],
  "defaultPrice": 1250.00,
  "defaultStock": 10
}
```

**সার্ভার থেকে প্রস্তুতকৃত রেসপন্স (Cartesian Product Rows):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Generated 6 variant combinations successfully",
  "data": {
    "totalCombinations": 6,
    "combinations": [
      {
        "title": "Red / M",
        "suggestedSkuSuffix": "RED-M",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [1, 3],
        "attributes": { "Color": "Red", "Size": "M" }
      },
      {
        "title": "Red / L",
        "suggestedSkuSuffix": "RED-L",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [1, 4],
        "attributes": { "Color": "Red", "Size": "L" }
      },
      {
        "title": "Red / XL",
        "suggestedSkuSuffix": "RED-XL",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [1, 5],
        "attributes": { "Color": "Red", "Size": "XL" }
      },
      {
        "title": "Blue / M",
        "suggestedSkuSuffix": "BLUE-M",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [2, 3],
        "attributes": { "Color": "Blue", "Size": "M" }
      },
      {
        "title": "Blue / L",
        "suggestedSkuSuffix": "BLUE-L",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [2, 4],
        "attributes": { "Color": "Blue", "Size": "L" }
      },
      {
        "title": "Blue / XL",
        "suggestedSkuSuffix": "BLUE-XL",
        "price": 1250,
        "stock": 10,
        "lowStockThreshold": 5,
        "attributeValueIds": [2, 5],
        "attributes": { "Color": "Blue", "Size": "XL" }
      }
    ]
  }
}
```
মার্চেন্ট এখন UI-তে এই রো গুলোর প্রতিটির আলাদা প্রাইস, স্টক বা ছবি এডিট করতে পারবে এবং প্রডাক্ট সাবমিট করবে।
</details>

---

## 🚀 সার্ভার সেটআপ ও রান করার নির্দেশিকা

### ১. ক্লোন ও ডিপেন্ডেন্সি ইনস্টলেশন
```bash
cd prisma-8-backend
npm install
```

### ২. এনভায়রনমেন্ট কনফিগারেশন (`.env`)
`.env.example` ফাইলটি কপি করে `.env` তৈরি করুন এবং প্রয়োজনীয় ক্রেডেনশিয়াল দিন:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# PostgreSQL Database (Prisma 8)
DATABASE_URL="postgres://username:password@host:5432/shopora_db?sslmode=require"

# JWT Secrets
JWT_ACCESS_SECRET="your_access_secret_key"
JWT_REFRESH_SECRET="your_refresh_secret_key"

# Cloudinary Storage
CLOUDINARY_NAME="your_cloud_name"
CLOUDINARY_KEY="your_api_key"
CLOUDINARY_SECRET="your_api_secret"
CLOUDINARY_FOLDER="shopora"
```

### ৩. প্রিসমা ডাটাবেজ আপডেট ও সিঙ্ক
```bash
# স্কিমা ফরম্যাট ও কন্ট্রাক্ট ফাইল ইমিট
npm run contract:emit

# ডাটাবেজে টেবিল মাইগ্রেশন প্রয়োগ
npx prisma db update
```

### ৪. ডাটাবেজ সিডিং (ডিফল্ট অ্যাডমিন ও ক্যাটাগরি তৈরি)
```bash
npm run seed
```

### ৫. সার্ভার চালুকরণ
```bash
# ডেভেলপমেন্ট মোডে (Hot-reloading)
npm run dev

# প্রোডাকশন মোডে
npm start
```
সার্ভার লাইভ হবে: `http://localhost:5000`  
হেলথ চেক ইউআরএল: `http://localhost:5000/api/health`

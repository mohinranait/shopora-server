/**
 * System Roles for Multi-Vendor Platform
 */
export const USER_ROLES = {
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  CUSTOMER: "CUSTOMER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Seller Verification / Account Status
 */
export const SELLER_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;

export type SellerStatus = (typeof SELLER_STATUS)[keyof typeof SELLER_STATUS];

/**
 * Product Approval Status (For Quality Control)
 */
export const PRODUCT_APPROVAL_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ProductApprovalStatus =
  (typeof PRODUCT_APPROVAL_STATUS)[keyof typeof PRODUCT_APPROVAL_STATUS];

/**
 * Product Publish Status
 */
export const PRODUCT_STATUS = {
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

/**
 * Product Types
 */
export const PRODUCT_TYPE = {
  SIMPLE: "SIMPLE",
  VARIABLE: "VARIABLE",
} as const;

export type ProductType = (typeof PRODUCT_TYPE)[keyof typeof PRODUCT_TYPE];

/**
 * Customer Order & Sub-Order Status
 */
export const ORDER_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * Payment Status
 */
export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/**
 * Payment Methods
 */
export const PAYMENT_METHOD = {
  COD: "COD",
  BKASH: "BKASH",
  NAGAD: "NAGAD",
  STRIPE: "STRIPE",
  SSLCOMMERZ: "SSLCOMMERZ",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

/** Payment methods customers can choose at checkout. Add BKASH / NAGAD here once their gateways are integrated. */
export const ENABLED_PAYMENT_METHODS: readonly PaymentMethod[] = [PAYMENT_METHOD.COD];

/**
 * Payout Request Status
 */
export const PAYOUT_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  PAID: "PAID",
  REJECTED: "REJECTED",
} as const;

export type PayoutStatus = (typeof PAYOUT_STATUS)[keyof typeof PAYOUT_STATUS];

/**
 * Return Request Status
 */
export const RETURN_STATUS = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
} as const;

export type ReturnStatus = (typeof RETURN_STATUS)[keyof typeof RETURN_STATUS];

/**
 * Wallet Transaction Types
 */
export const TRANSACTION_TYPE = {
  ORDER_EARNING: "ORDER_EARNING",
  COMMISSION_DEDUCTION: "COMMISSION_DEDUCTION",
  PAYOUT_WITHDRAWAL: "PAYOUT_WITHDRAWAL",
  REFUND_REVERSAL: "REFUND_REVERSAL",
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

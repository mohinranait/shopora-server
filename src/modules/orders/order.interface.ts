/**
 * Order Module TypeScript Interfaces
 */

export interface IOrderItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface IShippingAddress {
  fullName?: string;
  phone?: string;
  email?: string | null;
  streetAddress?: string;
  address?: string;
  city?: string;
  district?: string;
  division?: string;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  [key: string]: unknown;
}

export interface IPricedLine {
  product: any;
  selectedVariant: any;
  productId: string;
  variantId: string | null;
  sellerId: string | null;
  isPlatformOwned: boolean;
  productName: string;
  variantTitle: string | null;
  productImage: string | null;
  sku: string;
  price: number;
  comparePrice: number | null;
  costPrice?: number | null;
  quantity: number;
  totalPrice: number;
  isFreeShipping: boolean;
}

export interface ICreateOrderPayload {
  items: IOrderItemInput[];
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress | null;
  paymentMethod: string;
  couponCode?: string;
  notes?: string;
  guestEmail?: string;
  guestPhone?: string;
}

export interface IOrderRequester {
  id: string;
  role: string;
  sellerId?: string | null;
}

export interface ISubOrderListItem {
  id: string;
  subOrderNumber: string;
  orderId: string;
  orderNumber?: string;
  sellerId: string | null;
  isPlatformOwned: boolean;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  sellerEarnings: number;
  isPayoutSettled: boolean;
  escrowStatus: string;
  status: string;
  destinationCity: string | null;
  destinationState: string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  items: any[];
}

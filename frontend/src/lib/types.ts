export type TenantStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'REJECTED';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  gstin?: string | null;
  legalName?: string | null;
  pan?: string | null;
  billingAddress?: Record<string, unknown> | null;
  logoUrl?: string | null;
  state?: string | null;
}

export interface User {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  roles: { role: { id: string; name: string } }[];
}

export interface AuthUser extends User {
  permissions: string[];
}

// A product's sellable options — label is free text ("Half"/"Full", "70 Gram"/"1 Kg", anything),
// not a fixed weight/size field, so one mechanism covers every product type.
export interface ProductVariant {
  id: string;
  label: string;
  priceCents: number;
  compareAtCents?: number | null;
}

export interface Product {
  category: string;
  featured: boolean;
  images: string[];
  videos: string[];
  labels: string[];
  compareAtCents: number | null;
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  publishedAt: string | null;
  archivedAt: string | null;
  variants: ProductVariant[];
  gstRateBps: number;
  hsnCode: string | null;
}

/** Public, unauthenticated shape returned by GET /storefront/products — no draft/archive fields. */
export interface StorefrontProduct {
  stock: number;
  sold: number;
  publishedAt: string;
  category: string;
  featured: boolean;
  images: string[];
  videos: string[];
  labels: string[];
  compareAtCents: number | null;
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  variants: ProductVariant[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  archivedAt?: string | null;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'FULFILLED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  marketingOptIn?: boolean;
  unsubscribedAt?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  product: { id: string; name: string; sku: string };
}

export interface Payment {
  id: string;
  provider: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  billedToName: string;
  billedToGstin: string | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  issuedAt: string;
}

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export interface ReturnRequest {
  id: string;
  orderId: string;
  reason: string;
  status: ReturnStatus;
  refundCents: number | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  order?: { customer: Customer };
}

export interface Order {
  id: string;
  status: OrderStatus;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  currency: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  payment: Payment | null;
  events: OrderEvent[];
  invoice: Invoice | null;
  trackingNumber: string | null;
  courierName: string | null;
  returns: ReturnRequest[];
}

export interface InventoryItem {
  id: string;
  productId: string;
  quantityOnHand: number;
  reorderThreshold: number;
  product: { id: string; name: string; sku: string };
}

export interface AuthSession {
  accessToken: string;
  tenant: Tenant;
  user: AuthUser;
}

export interface StoreSettings {
  headline: string; tagline: string; description: string; heroImage: string; announcement: string;
  supportEmail: string; phone: string; address: string; deliveryNote: string;
  shippingCents: number; freeShippingThresholdCents: number | null; pickupEnabled: boolean;
  faq: { question: string; answer: string }[];
}
export interface Offer {
  id: string; code: string; title: string; description: string; kind: 'percent' | 'fixed'; value: number;
  minimumCents: number; maximumDiscountCents: number | null; startsAt: string; endsAt: string; active: boolean;
  maxRedemptions: number | null; perCustomerLimit: number | null;
}
export interface Review {
  id: string; productId: string; displayName: string; rating: number; body: string; createdAt: string;
  published?: boolean; product?: { name: string };
}
export interface StoreData {
  id: string; name: string; settings: StoreSettings; products: StorefrontProduct[]; offers: Offer[]; reviews: Review[];
}
export interface CartQuote {
  items: { productId: string; variantId?: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
  subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number; currency: string;
  couponCode: string | null; remainingForFreeShippingCents: number | null;
}
export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  intervalDays: number;
  features: string[];
  active: boolean;
}
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
export interface SubscriptionPayment {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}
export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  payments: SubscriptionPayment[];
}
export type ReferralStatus = 'PENDING' | 'ACTIVE' | 'ENDED';
export type CommissionStatus = 'PENDING' | 'PAID';
export interface ReferralCommission {
  id: string;
  rateBps: number;
  amountCents: number;
  status: CommissionStatus;
  paidAt: string | null;
}
export interface ReferralSummary {
  code: string;
  commissionBps: number;
  payoutVpa: string | null;
  referrals: {
    id: string;
    status: ReferralStatus;
    createdAt: string;
    refereeTenant: { id: string; name: string };
    commissions: ReferralCommission[];
  }[];
  totalEarnedCents: number;
  totalPaidCents: number;
}

export type CampaignChannel = 'email' | 'sms' | 'whatsapp';
export type CampaignAudience = 'all' | 'buyers' | 'prospects' | 'selected';
export interface Campaign {
  id: string;
  subject: string;
  body: string;
  channels: CampaignChannel[];
  audience: CampaignAudience;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'SENDING' | 'SENT' | 'FAILED';
  createdByEmail: string | null;
  createdAt: string;
  completedAt: string | null;
}
export interface AudiencePreview {
  recipients: number;
  unreachable: number;
  optedIn: number;
  totalCustomers: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TrendPoint {
  current: number;
  previous: number;
  /** null when the previous window was empty — no honest percentage exists. */
  changePct: number | null;
}
export interface ActivityItem {
  kind: 'order' | 'customer' | 'review';
  id: string;
  at: string;
  title: string;
  detail: string;
  link: string;
}

export interface Analytics {
  revenueCents: number; orderCount: number; avgOrderValueCents: number;
  daily: { date: string; revenueCents: number; orders: number; customers: number }[];
  trend: { revenue: TrendPoint; orders: TrendPoint; customers: TrendPoint; avgOrderValue: TrendPoint };
  customerSegments: { repeat: number; single: number; neverOrdered: number };
  salesByRegion: { region: string; revenueCents: number; orders: number }[];
  activity: ActivityItem[];
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  topProducts: { productId: string; name: string; revenueCents: number; quantity: number }[];
  productCount: number; lowStock: number; outOfStock: number;
  customerCount: number; newCustomers: number;
  reviewCount: number; pendingReviews: number; avgRating: number | null;
  setup: {
    publishedCount: number; sellableCount: number; withoutImages: number;
    contactSet: boolean; deliverySet: boolean; activeOffers: number;
  };
}

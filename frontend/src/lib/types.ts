export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  price_cents: number;
  currency: string;
  stock: number;
  compare_at_price_cents: number | null;
  is_featured: boolean;
  is_bestseller: boolean;
  badge: string | null;
  images: string[];
  custom_attributes: Record<string, unknown>;
  category_id: string | null;
}

export interface ActiveFlashSale {
  product_id: string;
  sale_price_cents: number;
  ends_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  position: number;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
}

/** Payload the admin product form sends to the create/update actions. */
export interface ProductInput {
  name: string;
  slug: string;
  description?: string;
  price_cents: number;
  currency?: string;
  stock?: number;
  compare_at_price_cents?: number | null;
  is_featured?: boolean;
  is_bestseller?: boolean;
  badge?: string | null;
  images?: string[];
  custom_attributes?: Record<string, unknown>;
  category_id?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface CategoryInput {
  name: string;
  slug: string;
  parent_id?: string;
  position?: number;
  description?: string;
  image_url?: string;
  is_featured?: boolean;
}

export interface StoreConfig {
  tenant_id: string;
  store_name: string;
  currency: string;
  locale: string;
  theme: StoreTheme;
  product_attribute_schema: Record<string, unknown>;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  preview?: boolean;
}

export interface LegacyStoreTheme {
  template?: import('./store-templates').StoreTemplateId;
  colors?: { primary?: string; primaryForeground?: string; background?: string; accent?: string };
  content?: { heroTitle?: string; heroAccent?: string; announcement?: string; tagline?: string };
  logoUrl?: string | null;
  font?: string;
}
export type StoreTheme = import('./store-templates').StoreDesignConfig | LegacyStoreTheme;

export interface StoreDesignState {
  draft: import('./store-templates').StoreDesignConfig;
  published: import('./store-templates').StoreDesignConfig;
  draft_revision: number;
  published_revision: number;
  published_at: string | null;
}

export interface MediaAsset {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  status: 'UPLOADING' | 'READY' | 'ARCHIVED';
  created_at: string;
  url: string | null;
}

export interface Entitlements {
  planKey: string;
  planName: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export type FlashSaleStatus = 'upcoming' | 'ongoing' | 'expired';

export interface FlashSale {
  id: string;
  product_id: string;
  product_name: string;
  product_price_cents: number;
  stock: number;
  currency: string;
  sale_price_cents: number;
  starts_at: string;
  ends_at: string;
  status: FlashSaleStatus;
}

export interface FlashSaleInput {
  product_id: string;
  sale_price_cents: number;
  starts_at: string;
  ends_at: string;
}

export interface Page<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

// --- Cart & checkout ---------------------------------------------------------

/**
 * A cart line as held in the browser (localStorage). Carries just enough to
 * render the cart offline; every price shown at checkout is re-quoted from the
 * backend, which is the sole authority on price and availability.
 */
export interface CartItem {
  product_id: string;
  name: string;
  price_cents: number;
  currency: string;
  image: string | null;
  quantity: number;
  /** Display-only chosen weight/size (e.g. "1kg"). Does not affect pricing —
   *  the backend prices by product_id. ponytail: per-variant price/stock needs
   *  a backend variant model. */
  variant?: string;
}

export interface PricedLine {
  product_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export interface CartQuote {
  currency: string;
  lines: PricedLine[];
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
}

export interface ShippingRate {
  service: string;
  label: string;
  carrier: string;
  amountCents: number;
  currency: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  product_id: string | null;
  name: string;
  price_cents: number;
  quantity: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customer_id: string | null;
  guest_email: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  shipping_address: ShippingAddress | null;
  items: OrderItem[];
  created_at: string;
}

export interface PaymentIntent {
  provider: string;
  public_key: string | null;
  provider_order_id: string;
  amount_cents: number;
  currency: string;
  order_id: string;
  requires_gateway: boolean;
}

// --- Shopper account ---------------------------------------------------------

export interface CustomerTokens {
  access_token: string;
  expires_in: number;
  customer: { id: string; email: string; tenant_id: string; email_verified: boolean };
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified: boolean;
  status: string;
  created_at: string;
}

export interface Address {
  id: string;
  label: string | null;
  full_name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface AddressInput {
  label?: string;
  full_name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}

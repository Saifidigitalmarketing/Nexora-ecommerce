// Hand-written types mirroring supabase/migrations. Regenerate with
// `supabase gen types typescript` once the project is linked if preferred.

export type UserRole = "customer" | "admin" | "rider" | "vendor";
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "processing"
  | "assigned"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cod" | "easypaisa" | "jazzcash" | "bank_transfer" | "card";
export type PaymentStatus = "pending" | "awaiting_verification" | "paid" | "failed" | "refunded";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  badge: string | null;
  is_official: boolean;
  is_active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  icon: string | null;
  short_code: string | null;
  is_featured: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  options: Record<string, string>;
  color_hex: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  sku: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
  detail?: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  brand_id: string | null;
  category_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  sku: string | null;
  badges: string[];
  specs: ProductSpec[];
  tags: string[];
  is_active: boolean;
  is_featured: boolean;
  is_flash_deal: boolean;
  flash_deal_ends_at: string | null;
  flash_deal_stock_total: number | null;
  rating_avg: number;
  rating_count: number;
  sold_count: number;
  created_at: string;
}

/** Product row with the joins used by cards and listings. */
export interface ProductCardData extends Product {
  brand: Pick<Brand, "name" | "slug"> | null;
  vendor: Pick<Vendor, "name" | "slug" | "badge"> | null;
  images: ProductImage[];
  variants?: Pick<ProductVariant, "id">[];
}

export interface ProductDetail extends ProductCardData {
  category: Pick<Category, "id" | "name" | "slug" | "parent_id"> | null;
  variants: ProductVariant[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  province: string;
  city: string;
  area: string;
  address_line: string;
  landmark: string | null;
  postal_code: string | null;
  is_default: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp: string | null;
  customer_email: string | null;
  province: string;
  city: string;
  area: string;
  address_line: string;
  landmark: string | null;
  postal_code: string | null;
  subtotal: number;
  discount_total: number;
  coupon_code: string | null;
  delivery_charge: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  status: OrderStatus;
  rider_id: string | null;
  rider_accepted_at: string | null;
  estimated_delivery_from: string | null;
  estimated_delivery_to: string | null;
  notes: string | null;
  cancel_reason: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  vendor_id: string | null;
  product_name: string;
  variant_label: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderStatusEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  is_active: boolean;
  is_public: boolean;
}

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DeliveryQuote {
  charge: number;
  eta_min_days: number;
  eta_max_days: number;
  zone_name: string;
  is_free: boolean;
  free_threshold: number | null;
}

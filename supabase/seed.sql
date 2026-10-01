-- =====================================================================
-- NEXORA — starter catalogue (from the approved Stitch screens).
-- Idempotent: rows are matched on slug/code and never overwritten.
-- Ratings and sold counts start at zero and are driven by real
-- reviews and orders.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
insert into public.delivery_settings (id, mode, base_charge, eta_min_days, eta_max_days, free_delivery_enabled, free_delivery_threshold)
values (1, 'area', 250, 3, 5, false, 3000)
on conflict (id) do nothing;

insert into public.delivery_zones (name, province, city, area, charge, eta_min_days, eta_max_days, priority)
select * from (values
  ('Karachi Metro',  'Sindh',   'Karachi',   null::text, 150::numeric, 1, 2, 10),
  ('Lahore Metro',   'Punjab',  'Lahore',    null,       200,          1, 3, 10),
  ('Islamabad',      'Islamabad Capital Territory', 'Islamabad', null, 200, 2, 3, 10),
  ('Rawalpindi',     'Punjab',  'Rawalpindi', null,      200,          2, 3, 10),
  ('Rest of Sindh',  'Sindh',   null,        null,       250,          2, 4, 0),
  ('Rest of Punjab', 'Punjab',  null,        null,       250,          2, 4, 0)
) v(name, province, city, area, charge, eta_min_days, eta_max_days, priority)
where not exists (select 1 from public.delivery_zones);

insert into public.store_settings (key, value, is_public) values
  ('store', '{"name": "NEXORA", "tagline": "Everything. One Place.", "support_phone": "", "support_whatsapp": "", "support_email": ""}', true),
  ('payment_accounts', '{
     "easypaisa": {"title": "NEXORA", "number": ""},
     "jazzcash":  {"title": "NEXORA", "number": ""},
     "bank_transfer": {"bank": "", "title": "NEXORA", "account_number": "", "iban": ""}
   }', true),
  ('trending_searches', '["iPhone 16 Pro", "Khaadi Kurta", "AirPods", "Headphones", "Charger", "Perfume"]', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Categories (8 top-level tiles from the home screen + subcategories)
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, icon, sort_order) values
  ('Electronics',   'electronics',  'devices',        1),
  ('Apparel',       'apparel',      'styler',         2),
  ('Home & Living', 'home-living',  'chair',          3),
  ('Beauty',        'beauty',       'spa',            4),
  ('Pantry',        'pantry',       'kitchen',        5),
  ('Audio & Gear',  'audio-gear',   'headphones',     6),
  ('Footwear',      'footwear',     'roller_skating', 7),
  ('Books',         'books',        'menu_book',      8)
on conflict (slug) do nothing;

insert into public.categories (parent_id, name, slug, icon, sort_order)
select p.id, v.name, v.slug, v.icon, v.sort_order
from (values
  ('electronics', 'Mobiles & Tablets',  'mobiles-tablets',  'smartphone',            1),
  ('electronics', 'Chargers & Power',   'chargers-power',   'battery_charging_full', 2),
  ('electronics', 'Wearables',          'wearables',        'watch',                 3),
  ('apparel',     'Men''s Kurta',       'mens-kurta',       'checkroom',             1),
  ('apparel',     'Women''s Lawn',      'womens-lawn',      'styler',                2),
  ('home-living', 'Kitchen Appliances', 'kitchen-appliances','microwave',            1),
  ('home-living', 'Desk & Decor',       'desk-decor',       'desk',                  2),
  ('beauty',      'Fragrances',         'fragrances',       'spa',                   1),
  ('pantry',      'Rice & Grains',      'rice-grains',      'grain',                 1),
  ('audio-gear',  'Headphones',         'headphones',       'headphones',            1),
  ('audio-gear',  'Earbuds',            'earbuds',          'earbuds',               2)
) v(parent_slug, name, slug, icon, sort_order)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Brands & official stores
-- ---------------------------------------------------------------------
insert into public.brands (name, slug, icon, short_code, is_featured, sort_order) values
  ('Apple',          'apple',          'phone_iphone',          null, true,  1),
  ('Samsung',        'samsung',        'devices_other',         null, true,  2),
  ('Khaadi',         'khaadi',         null,                    'KH', true,  3),
  ('Sapphire',       'sapphire',       null,                    'SP', true,  4),
  ('Anker',          'anker',          'battery_charging_full', null, true,  5),
  ('Xiaomi',         'xiaomi',         null,                    'MI', true,  6),
  ('Sony',           'sony',           null,                    'SO', false, 7),
  ('J. Fragrances',  'j-fragrances',   null,                    'J.', false, 8),
  ('Nordic Living',  'nordic-living',  null,                    'NL', false, 9),
  ('Bose',           'bose',           null,                    'BO', false, 10),
  ('Sennheiser',     'sennheiser',     null,                    'SE', false, 11),
  ('Marshall',       'marshall',       null,                    'MA', false, 12),
  ('Philips',        'philips',        null,                    'PH', false, 13),
  ('Guard',          'guard',          null,                    'GD', false, 14)
on conflict (slug) do nothing;

insert into public.vendors (name, slug, badge, is_official) values
  ('NEXORA Retail',           'nexora-retail',   'Verified',       true),
  ('Apple Flagship Store',    'apple-flagship',  'PTA Approved',   true),
  ('Anker Official Pakistan', 'anker-official',  '18M Warranty',   true),
  ('Sapphire Official',       'sapphire-official','Festive Edit',  true),
  ('Khaadi Official',         'khaadi-official', 'Flagship',       true),
  ('Sony Official',           'sony-official',   'Official Warranty', true),
  ('Samsung Pakistan',        'samsung-pakistan','PTA Approved',   true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Hero banner
-- ---------------------------------------------------------------------
insert into public.banners (title, subtitle, badge, image_url, cta_label, cta_link, sort_order)
select 'Summer Minimalist Living', 'Daily mindful design essentials, curated for you.', 'Curated Editorial',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBCM5UZUcy1QFF1Y14RQyj6LFyKQQ9Nr_rcgkINqQQJRyzG4lOUx9poeQ7r3wDz7Kgcpo3GF6hASfdopAOdcQrLkoW-WZHEcysfb_6qNjuhYBR9hwDNsDkDmpViD-Uh4_rBA19SR2onT44qpuKV8K2y3I_Sdjy2kFRKDMleEgw4H5D_4eztAq2JGJRhqp79SQDrb5TMhMG7vWPHZWw2i-1d1l5Uy9TGZxQciUfWr_WNUJM79ZRKGsw',
  'Shop Collection', '/categories/home-living', 1
where not exists (select 1 from public.banners);

-- ---------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------
insert into public.coupons (code, description, discount_type, value, min_order_amount, per_user_limit, is_public) values
  ('NEXORA1ST', 'Welcome voucher — Rs. 1,000 off your first order', 'fixed',   1000, 5000, 1, true),
  ('SAVE10',    '10% off (up to Rs. 2,000)',                         'percent', 10,   3000, 3, true)
on conflict (code) do nothing;
update public.coupons set max_discount = 2000 where code = 'SAVE10' and max_discount is null;

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------
with src (slug, name, vendor, brand, category, price, compare_at, stock, badges, featured, flash, short_desc, description, specs, tags) as (
  values
  ('airpods-pro-2nd-gen', 'AirPods Pro 2nd Gen', 'apple-flagship', 'apple', 'earbuds', 54999, 68000, 40,
    array['Official Warranty'], true, true,
    'Active Noise Cancellation, Adaptive Audio and USB-C MagSafe case.',
    'Apple AirPods Pro (2nd generation) deliver up to 2x more Active Noise Cancellation, Adaptive Audio, Conversation Awareness and personalised Spatial Audio. Includes USB-C MagSafe charging case with speaker and lanyard loop.',
    '[{"label":"Chip","value":"Apple H2","detail":"Computational audio"},{"label":"Battery","value":"Up to 6 hours","detail":"30 hours with case"},{"label":"Water Resistance","value":"IP54","detail":"Earbuds & case"},{"label":"Charging","value":"USB-C / MagSafe","detail":"Qi2 compatible"}]',
    array['airpods','earbuds','apple','wireless']),
  ('khaadi-pure-linen-kurta', 'Pure Linen Kurta', 'khaadi-official', 'khaadi', 'mens-kurta', 4250, 6500, 60,
    array['New Season'], false, true,
    'Breathable sage-green pure linen kurta with brass collar button.',
    'A minimal men''s kurta tailored from pure linen for Pakistani summers. Relaxed fit, side pockets and a subtle brass collar button.',
    '[{"label":"Fabric","value":"100% Linen","detail":"Breathable weave"},{"label":"Fit","value":"Relaxed","detail":"True to size"},{"label":"Care","value":"Gentle wash","detail":"Iron medium"}]',
    array['kurta','khaadi','linen','men']),
  ('anker-nano-30w-charger', 'Nano 30W Fast Charger', 'anker-official', 'anker', 'chargers-power', 4800, 5999, 120,
    array['18M Warranty'], false, true,
    'Compact USB-C PD charger — fast charges iPhone and Android.',
    'Anker Nano 30W USB-C charger with PowerIQ 3.0. Small enough for any pocket, powerful enough to fast charge phones, tablets and small laptops.',
    '[{"label":"Output","value":"30W USB-C PD","detail":"PowerIQ 3.0"},{"label":"Size","value":"Ultra compact","detail":"Foldable plug"}]',
    array['charger','anker','usb-c','fast charging']),
  ('sony-wh-1000xm5', 'Sony WH-1000XM5 Wireless Headphones', 'sony-official', 'sony', 'headphones', 94999, 105000, 25,
    array['PTA Approved', 'Official Warranty'], true, false,
    'Industry-leading noise cancellation with 30-hour battery.',
    'Sony WH-1000XM5 wireless noise cancelling headphones with Auto NC Optimizer, eight microphones, crystal-clear calls and up to 30 hours of battery life.',
    '[{"label":"Noise Cancelling","value":"Auto NC Optimizer","detail":"8 microphones"},{"label":"Battery","value":"30 hours","detail":"3 min = 3 hrs"},{"label":"Connectivity","value":"Bluetooth 5.2","detail":"Multipoint"},{"label":"Weight","value":"250 g","detail":"Soft fit leather"}]',
    array['headphones','sony','anc','wireless']),
  ('j-janan-gold-edp-100ml', 'Janan Gold Eau de Parfum 100ml', 'nexora-retail', 'j-fragrances', 'fragrances', 8200, 9500, 80,
    array['Bestseller'], true, false,
    'Warm amber oud fragrance with a long-lasting trail.',
    'J. Janan Gold is a rich amber and oud eau de parfum crafted for special occasions. 100ml glass bottle with gold cap.',
    '[{"label":"Volume","value":"100 ml","detail":"Eau de Parfum"},{"label":"Notes","value":"Amber, Oud","detail":"Warm & woody"}]',
    array['perfume','fragrance','j.','janan']),
  ('white-oak-desk-organizer', 'Solid White Oak Desk Organizer Tray', 'nexora-retail', 'nordic-living', 'desk-decor', 3850, 4500, 35,
    array[]::text[], true, false,
    'Handcrafted solid white oak tray for pens, watch and keys.',
    'A minimalist desk organizer tray handcrafted from solid white oak. Keeps pens, watches and everyday carry neatly in place.',
    '[{"label":"Material","value":"Solid White Oak","detail":"Oil finish"},{"label":"Size","value":"30 × 12 cm","detail":"3 compartments"}]',
    array['desk','organizer','oak','home']),
  ('sapphire-egyptian-cotton-kurta-charcoal', 'Egyptian Cotton Kurta — Charcoal', 'sapphire-official', 'sapphire', 'mens-kurta', 5990, 7200, 45,
    array['New Drop'], true, false,
    'Slim-fit charcoal kurta in soft Egyptian cotton.',
    'Sapphire men''s slim-fit kurta in premium Egyptian cotton. A clean charcoal tone for everyday and festive wear.',
    '[{"label":"Fabric","value":"Egyptian Cotton","detail":"Soft handfeel"},{"label":"Fit","value":"Slim","detail":"Mandarin collar"}]',
    array['kurta','sapphire','cotton','men']),
  ('iphone-16-pro-max', 'Apple iPhone 16 Pro Max', 'apple-flagship', 'apple', 'mobiles-tablets', 484999, 519999, 0,
    array['PTA Approved', 'Official Warranty'], true, false,
    'Grade 5 titanium, A18 Pro chip and 5x telephoto camera.',
    'iPhone 16 Pro Max with a 6.9" Super Retina XDR display, A18 Pro chip, Camera Control and a 48MP Fusion camera system. PTA approved with official Mercantile 1-year warranty.',
    '[{"label":"Processor","value":"A18 Pro Bionic","detail":"6-core CPU & 16-core NPU"},{"label":"Display","value":"6.9\" OLED Super Retina","detail":"ProMotion 120Hz Always-On"},{"label":"Camera","value":"48MP Triple Fusion","detail":"5x Optical Telephoto zoom"},{"label":"Build Chassis","value":"Grade 5 Titanium","detail":"IP68 Water/Dust Resistant"}]',
    array['iphone','apple','iphone 16 pro','mobile','pta']),
  ('apple-airpods-max-space-gray', 'Apple AirPods Max (Space Gray)', 'apple-flagship', 'apple', 'headphones', 174999, 195000, 10,
    array['Official Warranty'], false, false,
    'High-fidelity audio with Active Noise Cancellation.',
    'AirPods Max combine high-fidelity audio with industry-leading Active Noise Cancellation, spatial audio and a breathable knit mesh canopy.',
    '[{"label":"Chip","value":"Apple H1","detail":"Per ear"},{"label":"Battery","value":"20 hours","detail":"ANC on"}]',
    array['airpods max','headphones','apple']),
  ('anker-soundcore-space-one', 'Anker Soundcore Space One', 'anker-official', 'anker', 'headphones', 19500, 24000, 50,
    array['Express 24h'], false, false,
    'Adaptive ANC headphones with 40-hour playtime.',
    'Soundcore Space One by Anker with 2x stronger voice reduction, LDAC hi-res wireless audio and up to 55 hours of playtime.',
    '[{"label":"ANC","value":"Adaptive","detail":"2x voice reduction"},{"label":"Battery","value":"Up to 55 hours","detail":"ANC off"}]',
    array['headphones','anker','soundcore']),
  ('bose-quietcomfort-45', 'Bose QuietComfort 45', 'nexora-retail', 'bose', 'headphones', 78500, 92000, 15,
    array['COD Available'], false, false,
    'Iconic quiet, comfort and sound with 24-hour battery.',
    'Bose QuietComfort 45 wireless noise cancelling headphones with Quiet and Aware modes, 24 hours of battery and plush comfort.',
    '[{"label":"Modes","value":"Quiet / Aware","detail":"Tap to switch"},{"label":"Battery","value":"24 hours","detail":"USB-C"}]',
    array['headphones','bose','anc']),
  ('sennheiser-accentum-plus', 'Sennheiser Accentum Plus', 'nexora-retail', 'sennheiser', 'headphones', 44999, null, 20,
    array[]::text[], false, false,
    'Hybrid ANC, touch controls and 50-hour battery.',
    'Sennheiser Accentum Plus wireless headphones with adaptive hybrid ANC, intuitive touch controls and up to 50 hours of battery life.',
    '[{"label":"Battery","value":"50 hours","detail":"Fast charge"},{"label":"Codec","value":"aptX Adaptive","detail":"Hi-res"}]',
    array['headphones','sennheiser']),
  ('marshall-major-iv', 'Marshall Major IV Wireless', 'nexora-retail', 'marshall', 'headphones', 38000, 42000, 30,
    array[]::text[], false, false,
    'Iconic on-ear design with 80+ hours of playtime.',
    'Marshall Major IV on-ear wireless headphones with wireless charging, 80+ hours of playtime and the iconic Marshall control knob.',
    '[{"label":"Battery","value":"80+ hours","detail":"Wireless charging"},{"label":"Type","value":"On-ear","detail":"Foldable"}]',
    array['headphones','marshall']),
  ('anker-67w-gan-wall-charger', '67W GaN Wall Charger', 'anker-official', 'anker', 'chargers-power', 11500, 13000, 70,
    array['18M Warranty'], false, false,
    '3-port (2C1A) ultra-compact GaN charger for laptop and phone.',
    'Anker 67W GaN charger with two USB-C and one USB-A port. Charge a MacBook, phone and earbuds at the same time.',
    '[{"label":"Output","value":"67W max","detail":"2C1A"},{"label":"Tech","value":"GaN II","detail":"Ultra compact"}]',
    array['charger','anker','gan','laptop']),
  ('sapphire-mens-fine-cotton-kurta-navy', 'Men''s Fine Cotton Kurta', 'sapphire-official', 'sapphire', 'mens-kurta', 4250, 4750, 0,
    array['Festive Edit'], false, false,
    'Navy blue 100% Egyptian cotton with minimal collar embroidery.',
    'Deep royal navy kurta in fine Egyptian cotton with minimal embroidery on the collar. Available in S to XL.',
    '[{"label":"Fabric","value":"100% Egyptian Cotton","detail":"Fine count"},{"label":"Colour","value":"Navy Blue","detail":"Minimal embroidery"}]',
    array['kurta','sapphire','navy','men']),
  ('philips-air-fryer-xxl', 'Philips Air Fryer XXL 7.2L', 'nexora-retail', 'philips', 'kitchen-appliances', 38500, 49999, 18,
    array['Official Warranty'], false, true,
    'Family-size digital air fryer with Rapid Air technology.',
    'Philips Airfryer XXL with Fat Removal technology, digital display and 7.2L capacity for family meals.',
    '[{"label":"Capacity","value":"7.2 L","detail":"Family size"},{"label":"Power","value":"2225 W","detail":"Rapid Air"}]',
    array['air fryer','philips','kitchen']),
  ('guard-supreme-kernel-basmati-5kg', 'Supreme Kernel Basmati Rice 5Kg', 'nexora-retail', 'guard', 'rice-grains', 2650, 2900, 200,
    array['Express 24h'], false, false,
    'Extra-long grain aged basmati rice, vacuum sealed.',
    'Guard Supreme Kernel Basmati — aged, extra-long grain rice with a rich aroma. 5 kg vacuum-sealed pouch.',
    '[{"label":"Weight","value":"5 kg","detail":"Vacuum sealed"},{"label":"Grain","value":"Extra long","detail":"Aged"}]',
    array['rice','basmati','pantry','grocery']),
  ('samsung-galaxy-watch-6-classic', 'Galaxy Watch 6 Classic 47mm LTE', 'samsung-pakistan', 'samsung', 'wearables', 62500, 79999, 22,
    array['PTA Approved'], true, false,
    'Rotating bezel, sapphire crystal and advanced health tracking.',
    'Samsung Galaxy Watch 6 Classic with a rotating bezel, sapphire crystal glass, LTE and advanced sleep and heart tracking.',
    '[{"label":"Size","value":"47 mm","detail":"Stainless steel"},{"label":"Connectivity","value":"LTE + Bluetooth","detail":"eSIM"}]',
    array['watch','samsung','wearable','smartwatch'])
)
insert into public.products (slug, name, vendor_id, brand_id, category_id, price, compare_at_price, stock, badges,
                             is_featured, is_flash_deal, flash_deal_ends_at, flash_deal_stock_total,
                             short_description, description, specs, tags)
-- No discounts or flash deals by default: the owner turns them on per product
-- from Admin → Products (compare-at price / flash deal) when a sale starts.
select s.slug, s.name, v.id, b.id, c.id, s.price, null, s.stock, s.badges,
       s.featured, false, null,
       null,
       s.short_desc, s.description, s.specs::jsonb, s.tags
from src s
join public.vendors v on v.slug = s.vendor
join public.brands b on b.slug = s.brand
join public.categories c on c.slug = s.category
on conflict (slug) do nothing;

-- Images
insert into public.product_images (product_id, url, alt, sort_order)
select p.id, i.url, p.name, i.sort_order
from (values
  ('airpods-pro-2nd-gen', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDq4Z_3Z_4wPojjCVIt9Psj4CPlkEuiBOCjpQoYobPa9z4WpM7ehgRfs6zGADJjLBfYfGwWbWi1KSxl99-GxQ_kTfcgRQ7Yaz_eg0NP6xzPRYsNg8T85aqnVEQXWEGjsfkG8iwAYlC9aBcT9K8EBEMlfMAUiYcFNaxE_TRiUY5xklc4P1a0yYrbZaUecUeHK20RJe1RaPzCP7EtmKRmlJFqPI2p3CczcKng_-vlKQs2G1ECK82DIyQ'),
  ('airpods-pro-2nd-gen', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuABd2hEHzEy6N7vFOm0idItvu2cEyiU0VXZc8oZdf2o6_tdC0lN7-Og5yPY94onniypTIoDIzcGCClmmXj26co2GAb4QhHCC8xz8bIy5CGv_kpTldKPBHyhO71u6Gxh2Wf2NVgi7SPPcn47Pe4jUe04LN7AZ1zrZAUbHMNBfVonGwHiRvAaI8mfKOpylU2UiLoUaD5oZopU-j7z1QvzMlRPO0aaTTCvbcrUml20DQdzr9v43j6jzSQ'),
  ('khaadi-pure-linen-kurta', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiyDpQBbwzqhaHGGMuW_oa-Ff0U8H7B4kI7pmTJVBATUS9C-UJk__b4CfzUSwxnaxifWGPKpehxD_1EXpFxOAoKTEapdBeP8mGq2XrNj1agcR8cqPCvJIS3QoUBYme_5BYpZReVvujsC4RAssBLdPPuuu8khnauuvLT2KoXHTis10Oubet_zF1o2qsq4gvhQvYmAGfJk8vcYnG4M8-L6wq8h1uAuldcRJxxg2UwUq0W4aY3NYdaTw'),
  ('anker-nano-30w-charger', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBV7-5aHAKivZSslDA1vJ2DOwfV6Ulx6OSiFAJHBzNaEleAAIEn9TzFRurgtz6BBLw_VTiVzhCtLXoTy1iQmsaDrCxVxJQKy_po2IGfuK1pGR9MHchp3n1366T7TMuZRKA-KKk0b5kqpwmqD_5w0-S-Q_xH-71mBzYyy24QHNGsq_fvEFWwOcgD_nTHW3BCRZd7lJrA-oXdHyzQB-5sZgvNs-N4NHAwIph82rHps9PsERB2kzT3gro'),
  ('sony-wh-1000xm5', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaMyxteur6tosDByoH4qm8stJC9k0OhvDd0y3Yp6xeEPK7If0CcQKtvYr_4Fa7DTHUuLFfVOOXxC7otk1Zu0SMWmojIKCGXZFl6CS0JbGE-P_7W9xlpd93jg3ceCeokbucWq2GcBuSiR9fafO-6P91hYzR_ad9DlRwfmWfhLV6xIxfdMZxWNmONMBICRPew6JazN-npygCQ7Pcuu9lEEGERf7M8325ae1BDlNSWn40C7zSDR3XCZs'),
  ('sony-wh-1000xm5', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCZSTrBUHNbvXEdq0zIZ_wi0hMMwddOYQf6d0Ti9R8wuJKdJ8t5l2viv0hG8OcWGSXBX06YGEGR_PeANhub6eKeF_5xm4u45wi8N1zWaUnyErTd7nb13woZGIh86S5L8GptTI9LujujO5iydX17hlugT59Ft7XdwSXpcFGp6Qen7E18_PBCn57s42qrDSBNbpZJWIzTbSrWg9PRDDiSQF2EVXG0fiidZO0Q_XeX1_lUUrNXbtB3izE'),
  ('sony-wh-1000xm5', 2, 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4KfXsp2nVn6wwDdlyiLIErR0znYd9hTOuRSt34r6Y7Iy1jvGAXZKYGZmXNa2gswXIGyqvMa_S7rMLAlGe69cSDPqmI4_PBT0lxkNyXGTsiZRxE1yJ0ECSRzonF1DKmXjxPnaFCIkz2FkoW-BYRQS8uZznkakaGjYCIU5FTrEB985wQb8G99-JdZYukDMzykv3qHnwggV4fkilK0x9TlJz-ootG28h4Sj9EOdsDVK17H9_D8XvFYc'),
  ('j-janan-gold-edp-100ml', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhwAbfYkvK5IrPxBPYZnG_RkgMFE04qr4pwlPpfcrkJSeAv1JLhM2QXaxehF77ggzqB4BGv1LuL23yz9tdx6M4pBP3d14xqs9V4tI-WswvLDB6HtZTpxw-mYXR84pVSlpNzA86f5DDGXfZ5GVIolE_M8L6B6E2NfKCyowStPPlgxLsg8t2e5PYiO9EwL7ThioxeYv0jsrAbcMUoEYjBdyosDgZ6IsQZxIrZfu7R0WrwozmKcobBok'),
  ('j-janan-gold-edp-100ml', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfEWOXNeJNWFCMWxXFCtQdL8H7z2PETGlDJ9JSNDz9RKGT5Sitx9j8OSSt_jEJ-vmcA7fLDHBxIfFpKEK-FAWwPvlJf5oBDHXtT5PiSKZsgnF8ll5xI3zoEWucMLMTi_usUewb9_d2ZfFVaKe7Io8EyMNw54G_2HBivEDKg_hngs8l32ZS542CZ39YYgd6mL4FQPgeiKNhsj2W0VBd09-Jdvfk6QW1YhbJeZPw3n7ELFowANz33YE'),
  ('white-oak-desk-organizer', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2N95Bvn1CjBSmEGAlz8qPMfj2G5ww0eifX_v8CfwDlLJigtPkf3dk8FSSTO4cGZmpqh93ELn_iPi1oHk3qvmTvIiFtJy8hvhympT3eJvuk0fAx1R_nOGsM2sjDRWwxHL52Wg4EzsTrrtgBSSUZiZYmEHTBPziILX2y6IhJmo7ddrSUJNEk3d_9e7bTsKtWwHs4LjBdti8XJ8FsBtUlf4_XI3JrPIdm2Jcyj1-dc4Q1jLipdaoEz4'),
  ('sapphire-egyptian-cotton-kurta-charcoal', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSXzKAmwYqzGlCAosDKvchY578-3OFkki9MukhnxY7H_b7tv9Jsiu4QzgggtR5iOPb5_DltYgHwL6r8ZlfIS0_e_CA6kZnMtiR5GFAcPI_PCQCTp3a1fPcSJ5D0j1Jc2OdMehAaUpqE8Qc8OtXCyZ7WSzot8i-40QW_NodS2olyaGZf0Gkx4N3jDKwtiOBwIk_myWfkSk2WB5XM7ZNcMr1yuvZAns19uvYxP7g5e4HDbJMh7b0dsw'),
  ('sapphire-egyptian-cotton-kurta-charcoal', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRPIDVylwa16lBS7bnEKMp-Tw3ENNI5ydftrNuk_kf1w-uxekRuMEX5ex2jiC5Xc-xpGLH4ohKT54dohTjug_XJ2d-c6E2gl0XBSIHDrqOKhbxoN4JJ-8I-F6BYgHGxeCdxCieUEXhAA_RzeBvO33PSU8PhqlDzJKp_GPTI1OFwLvVx4mLjAFJgXSfTZAWkqNj2wkLSmXEy9GXt0JSoJrxEbJ73SnMmzvjJ9zxnChLeuEi-f9FUpM'),
  ('iphone-16-pro-max', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfrY2ccbkEQ0Vmla_WHoJWt1lnYT_1ZiLYMDpdM3pPYNPTbWIJJL7zfRNQUJ2hRV0SadI5SGfuPUph-hy-ZoI_aZK_x_K5lNO7KMu5O3QGJn-wbI9EMwBsxdnNYq78EtVZY6bxWx0V8cTA_aZTal8UKw-3FhTjARAnCF8VrQ30LTJf5pORZtWV6zJLy7zmy-TOaIqYasAHbrD2R7VuNHSN99J9QtzWFMJkXvgjpnHgmIvOY9HnNrY'),
  ('iphone-16-pro-max', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCT_sgyMDe3hcNOzE6RevNLCJGYo8DKILpzB_EhaTtOwlEQ0-dpy8QiLlJ7pFdS1YttWPxWzrbMWeRkDSZElZsq2-PE0yYC3fzCBDLHgQEp3wEaLs0RrlO9DsrBmINfUFHVeIvGQYAIRjmT8SZXyltCWvl3-IET8_cDbI-EM2K3N_o76U5RO9eiSJpXtQqPgKoFTCW-8FzOcPDK2RYVNBxMJ8Vskyc0h2pdhye5DsIQX7EhDS-t0ac'),
  ('iphone-16-pro-max', 2, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXdx7PUMArFYuw6FMcHNhBjG0Opxl7e9wfwM9f9nZzsQ32W-NQAOJyrfTI6i9NU_EHjo89iRNh-_syeKTFAkMibbMSB6CzCkzpnPMbGu1CixxWDGW3b_rB605kaU6wUL6LjeSuet3O8nexalSZDQVpp_9ydRa2hPiNDMeBljAQ9I0hTjLsOroIGmnYB8eCnlG4W_mq_pOOFn3RtF7uC0lCwcZfkYxJfb8HdNhuutFOFEPQ1oEwVQk'),
  ('apple-airpods-max-space-gray', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfI-ilRyz32gedp-k08-5oBtIziAOixN3VgL3yfctjqG8EnqeLUf2smUNkhm0B6My6S7sfjXfNC1O7Wkx_8K6LrdXLkLrrQdd_8kXQ-aEJDg1rZ71P-wkA3HPzljKTvW1Pw9VBA73E7LqNzNk9mXeORpNRpohBwCw9Gt2SjxHCU9t-RVw-kfzR59vd9CHTNFGKKsXV4yhFLyh4aaFBbVjc4s0J5vb-fneVsMxSfTyMTdTTdaZTXZ0'),
  ('anker-soundcore-space-one', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDec3MUsphUfTpeO_0wjAP7ReEd16XH_xfpQRPuWKDQK68khQ7ioP8TQP29RUU6jb9bFJgs3Zy3hohqwRbIs-6MsiaY5y6sTq8Zuia7hubgDdPF42xxfqi25vByWpcv_YUOfQgUlmWLueocUemgv_YxLoF5Xj1wDgGbs1yoAYOcZu5GDatN-bq79CTR4O-FUhO7EmooYZPNpy-pWzER80eKDBst61PWbK2swTyMsThrZnlGA2taiDY'),
  ('anker-soundcore-space-one', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3b5pQ1JfInOapEFcm7ov4H4V25Sxzxt3volHM26fX9Vn6NoCkO8gBhMA5X_kRv0KorqExbu97hBm66TRstRgWK_8mpNHorLnIftCUR0Kq7zKURuDbaoRl_WUdzmmrcOyqGzIoyBZl_i0RVf0munvfOKrecF2SeHrfTyVHmUEui8YEfVyYchE14yHQOvHSQy3SM5uxnAOgT-81_Y4RFTXmID24wrX4RC_RyoGxK8NUl9W_aAHXEa0'),
  ('bose-quietcomfort-45', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuADVCDRVsCiE2duufq2il94yU6mPHLjD2o5SXe7i97wEK7VytnG_wXIRqfrsT7VG2N6gwACh4IvCkvngOUav0TB8shcOjr7cwADWYxADxNpOD3X_VqX7YDdR-QrQ4Dn4VA-NO2e2nyaVAOmPGl7jemvQJWAVJ8l9Qe-PL-wlIbvV7AH3K5ArweKsz0Gqqz5Yj8dCuOPkIXVcDghi-kuVFBJTHTPkgXjSrvi1FRaJez2BjhFwezj4Jg'),
  ('sennheiser-accentum-plus', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAioyRzYJk910igDKlI98fc6ImC5kVStAvadvFIb1CM_X7IjmB5CbOlcUYYw_Wk79T-KYNicW-E82gimQT3f-IonTGIrnOwc4nEZ54ImW4qIAd09leJIPMqGGvR9yWt4qqEiyjXJ3qo7IH8lJ5430_9h_V82pavOTtoxHvEARgs_G2kDvC7-UStBikNhwqtK-bvtdrbKxGr9ZHkw30tD75r1J4rMdyrtwKReDXqa9WeUM8u2V2Is5Q'),
  ('marshall-major-iv', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhpAnA6s6G5780DcoZhNM3-bioE6Lwo_1tp-PGWAEWrfwCQu4uz10ZGgCaFQLJIZolyzs7CRXm_cw4F3OCxMH_2QCUJu2u8VokWwIwPlz5d1V4MkrIsXmpgdwc70lz0uJQChvW83P_nNixT1HbXNuSX2u2PQJIc-w1FiKx26bxqg0zmcLvxJQmSSP5wjDCwimoeaJhWzZSUG6pTJGYleSHewapjdKK9VbaD4abxIGUVevpxFq4xpY'),
  ('anker-67w-gan-wall-charger', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVyizbru8_UmVcvkbrgWGRXjFGe1kPSSVul14bOqI2QlezApwRO3ipYvTf_ea9WrFr7nQgM-oL4tY5i9UQpH2J4yj7XZwOXcxpyTdcLf3YUsmacd6JGMrEDVqmwFFKdAiA5GpRYEr8YMVeP91DjE2X2egvkSL4MsVHh1zbjTOy3MK9CutVzyoV9NtS_qR7UTBWv0-WBrDFZ5tZQnZm0HxSS8ZiOzRWUEfJvD6e2XSwMIwqglptIPU'),
  ('sapphire-mens-fine-cotton-kurta-navy', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwM3AYLe_zjB8nlN5Eex2OXeQGB4oaHKRvKluUGUZNKwwpea9ib7xoEb5Beyx0sh-eDgyDtDqMXg9SSB0iZ2uABiTOnONFm6dbQv23dG9DvtPvFdN0WNxDOSTxpz_2xC3IsSbbT68tBXDuSZvPcubvDvW1sIsX1Htqj4ml1B8e0MhJBEIL9KtzhNLO0gQW65iQDk8JLCYM1jtosCUmcsvN7scxutC2HZPMpa6Jb5wR7sM55Izdy3E'),
  ('philips-air-fryer-xxl', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBy-DJcpJAloPavc3Xp-ILFqrRrUtB8TeG-OJywtwUyan_UwfqqPLjsxTeaHBCp_lFDZJ6KMK8jlQ8A3TUz-taO8q3sPndgD30KVtJ1Ufnm1IrPfAgw9z9wvd1tpfzEmYGmFyq6MY6cp9z9Hf2MNOhAFrhI399KXTKlL6yUJ8fj2mirhrvBi4NaAGmaFjxG53CNu5Pj4uFwiSlPQ2rxf0jEzaJ_Fyd_m7wg7aPIQvmp73KLAxWlqzM'),
  ('guard-supreme-kernel-basmati-5kg', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCnW_dzDLe1tbu2C_U97zD8u-ul6Olab6m-ak-Grbr9iESwZbcyg6c6aesUdResuAgU3zLuUfDs_0TFEi9USC8CFabw8ZjoSqOzcWkGRVZSvMF2-R6byqerbenFXZgl6N7tYKQZSN6OCO4edtAolfR7AvfdQ_fRKG68C88LsGP8i9UHo5q--fipwSbqhvEwbnil3Wtc7B0zXIXEWkSJsrc-OyNUpULpxFrjV81GBa4F4QpGsyh9XEk'),
  ('samsung-galaxy-watch-6-classic', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhr2ie6I7g-gA6V8YQE2h15MT8KDTjLB9YPnaS7VkFsquRVGPBg4qLt7lyEpOSMmLtDpWnwFfq89DEjkFVZkig9SGthKa8FCUij_8FUG0dzKf0Jt2K6R4OD1tk7_Q0-izu7ZnsBLvdWUUNJx_ZzjnWWTnHk7LRNv2wUlbsNEUa7RJlOERH3SKLFXH3QT5jrTLuSL32nCtXBxOO7YhSgAGevaLRDujBqxzYO9NuuuxyMzhMfvHCXt8')
) i(slug, sort_order, url)
join public.products p on p.slug = i.slug
where not exists (select 1 from public.product_images pi where pi.product_id = p.id);

-- Variants: iPhone 16 Pro Max (finish × storage)
insert into public.product_variants (product_id, label, options, color_hex, price, compare_at_price, stock, sort_order)
select p.id, f.finish || ' / ' || s.storage,
       jsonb_build_object('Finish', f.finish, 'Storage', s.storage),
       f.hex, s.price, null, 8, f.ord * 10 + s.ord
from public.products p
cross join (values ('Natural Titanium', '#9c9589', 1), ('White Titanium', '#e3e4e5', 2),
                   ('Desert Titanium', '#c5b49e', 3), ('Black Titanium', '#3b3a3e', 4)) f(finish, hex, ord)
cross join (values ('256 GB', 484999::numeric, 519999::numeric, 1), ('512 GB', 544999, 579999, 2),
                   ('1 TB', 614999, 649999, 3)) s(storage, price, compare_at, ord)
where p.slug = 'iphone-16-pro-max'
  and not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- Variants: Sapphire navy kurta (size)
insert into public.product_variants (product_id, label, options, price, compare_at_price, stock, sort_order)
select p.id, 'Size ' || sz.size, jsonb_build_object('Size', sz.size), 4250, null, 12, sz.ord
from public.products p
cross join (values ('S', 1), ('M', 2), ('L', 3), ('XL', 4)) sz(size, ord)
where p.slug = 'sapphire-mens-fine-cotton-kurta-navy'
  and not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- Keep parent stock in sync with variant stock for display
update public.products p set stock = sub.total
from (select product_id, sum(stock) total from public.product_variants group by product_id) sub
where sub.product_id = p.id and p.stock = 0;

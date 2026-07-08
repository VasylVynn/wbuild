import type { Tenant, Page } from "./types";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * In-memory seed — MVP bring-up only (brief §5.5).
 * Swap these arrays for Supabase queries in data.ts without touching any caller.
 *
 * ONE florist tenant ("kvity") with a fully populated one-page home.
 * All Ukrainian content; image URLs are real Unsplash flower photos
 * (accessible in dev without auth).
 */

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

const kvityFacts: FloristFacts = {
  businessName: "Квіткова Майстерня",
  city:         "Львів",
  phone:        "+38 (067) 123-45-67",
  address:      "вул. Сербська, 15, Львів, 79000",
  hours:        "Пн–Пт: 9:00–19:00, Сб–Нд: 9:00–17:00",
  about:
    "Ми — маленька квіткова майстерня у серці Львова, де кожен букет " +
    "складається з любов'ю та увагою до деталей. Працюємо з 2015 року.",
  services: [
    { name: "Весільний букет",          price: "від 1 800 грн", description: "Індивідуальний дизайн для нареченої" },
    { name: "Святковий букет",          price: "від 600 грн",   description: "На день народження, ювілей чи свято" },
    { name: "Квіткова композиція",      price: "від 900 грн",   description: "Настільні та підвісні аранжування" },
    { name: "Корпоративне оформлення",  price: "від 3 500 грн", description: "Декор офісів, ресторанів, заходів" },
    { name: "Похоронний вінок",         price: "від 1 200 грн", description: "Скорботні композиції та вінки" },
    { name: "Квіти поштучно",           price: "від 50 грн/шт.", description: "Троянди, піони, тюльпани та інші" },
  ],
  testimonials: [
    {
      quote:  "Замовила весільний букет — він перевершив усі очікування. Дякую за увагу до кожної деталі!",
      author: "Ірина К.",
      role:   "наречена",
    },
    {
      quote:  "Швидко доставили букет мамі на ювілей. Квіти свіжі, упаковка ідеальна. Рекомендую!",
      author: "Максим Р.",
    },
    {
      quote:  "Оформляли корпоратив у нашому офісі — результат просто чудовий. Колеги були в захваті.",
      author: "Оксана М.",
      role:   "керівниця відділу маркетингу",
    },
  ],
  socials: [
    { label: "Instagram", href: "https://instagram.com/kvity.lviv" },
    { label: "Facebook",  href: "https://facebook.com/kvity.lviv" },
  ],
};

export const seedTenants: Tenant[] = [
  {
    id:                "kvity",
    host:              "kvity.lvh.me",
    canonicalHostname: "kvity.lvh.me",
    navMode:           "onepage",
    status:            "published",

    brand: {
      businessName: "Квіткова Майстерня",
      tagline:      "Квіти, що говорять серцем",
    },

    footer: {
      phone:     "+38 (067) 123-45-67",
      address:   "вул. Сербська, 15, Львів, 79000",
      hours:     "Пн–Пт: 9:00–19:00, Сб–Нд: 9:00–17:00",
      social: [
        { label: "Instagram", href: "https://instagram.com/kvity.lviv" },
        { label: "Facebook",  href: "https://facebook.com/kvity.lviv"  },
      ],
      copyright: "© 2025 Квіткова Майстерня. Всі права захищені.",
    },

    theme: {
      colors: {
        primary:           "#c4677c", // warm rose
        primaryForeground: "#ffffff",
        background:        "#fdf8f4", // soft cream
        foreground:        "#2d1f22", // deep brown-red
        muted:             "#f2e4e8", // blush
        accent:            "#6b9e6b", // muted sage green
      },
      fonts: {
        heading: "display",
        body:    "sans",
      },
      radius: "xl",
    },

    facts: kvityFacts,
  },
];

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export const seedPages: Page[] = [
  {
    id:          "kvity-home",
    tenantId:    "kvity",
    slug:        "",
    pageType:    "home",
    title:       "Головна",
    isPublished: true,
    showInNav:   false,
    navOrder:    0,

    blocks: [
      // -----------------------------------------------------------------------
      // Hero — full-bleed opener; not in nav
      // -----------------------------------------------------------------------
      {
        type: "hero",
        props: {
          eyebrow:  "Квіткова Майстерня у Львові",
          title:    "Квіти, що говорять серцем",
          subtitle: "Букети, композиції та декор для ваших найособливіших моментів",
          imageUrl: "https://images.unsplash.com/photo-1490750967868-88df5691cbe9?w=1200&q=70",
          ctaLabel: "Написати нам",
          ctaHref:  "#contacts",
        },
        showInNav: false,
        hidden:    false,
      },

      // -----------------------------------------------------------------------
      // Services
      // -----------------------------------------------------------------------
      {
        type: "services",
        props: {
          title: "Наші послуги",
          items: [
            {
              name:        "Весільний букет",
              price:       "від 1 800 грн",
              description: "Індивідуальний дизайн, який підкреслить образ нареченої",
              imageUrl:    "https://images.unsplash.com/photo-1523575708161-ad0fc2a9b951?w=600&q=70",
            },
            {
              name:        "Святковий букет",
              price:       "від 600 грн",
              description: "Яскраві аранжування на день народження, ювілей або свято",
              imageUrl:    "https://images.unsplash.com/photo-1585320806297-9794b3e4aeab?w=600&q=70",
            },
            {
              name:        "Квіткова композиція",
              price:       "від 900 грн",
              description: "Настільні й підвісні композиції для дому або офісу",
              imageUrl:    "https://images.unsplash.com/photo-1487530811015-780780169c02?w=600&q=70",
            },
            {
              name:        "Корпоративне оформлення",
              price:       "від 3 500 грн",
              description: "Декор для офісів, ресторанів, конференцій і заходів",
            },
            {
              name:        "Похоронний вінок",
              price:       "від 1 200 грн",
              description: "Скорботні композиції та вінки з дотриманням традицій",
            },
            {
              name:        "Квіти поштучно",
              price:       "від 50 грн/шт.",
              description: "Свіжі троянди, піони, тюльпани, лілії та сезонні квіти",
            },
          ],
        },
        anchor:    "#services",
        navLabel:  "Послуги",
        showInNav: true,
        hidden:    false,
      },

      // -----------------------------------------------------------------------
      // Gallery
      // -----------------------------------------------------------------------
      {
        type: "gallery",
        props: {
          title: "Наші роботи",
          images: [
            {
              url: "https://images.unsplash.com/photo-1490750967868-88df5691cbe9?w=800&q=70",
              alt: "Ніжний рожевий букет із троянд",
            },
            {
              url: "https://images.unsplash.com/photo-1487530811015-780780169c02?w=800&q=70",
              alt: "Весняна квіткова композиція",
            },
            {
              url: "https://images.unsplash.com/photo-1523575708161-ad0fc2a9b951?w=800&q=70",
              alt: "Весільний букет із білих та рожевих квітів",
            },
            {
              url: "https://images.unsplash.com/photo-1508610048659-a06b669e3321?w=800&q=70",
              alt: "Яскраві тюльпани у кошику",
            },
            {
              url: "https://images.unsplash.com/photo-1585320806297-9794b3e4aeab?w=800&q=70",
              alt: "Розкішні піони у пастельних тонах",
            },
            {
              url: "https://images.unsplash.com/photo-1468327768560-75b778cbb551?w=800&q=70",
              alt: "Ароматна лаванда у скляній вазі",
            },
          ],
        },
        anchor:    "#gallery",
        navLabel:  "Галерея",
        showInNav: true,
        hidden:    false,
      },

      // -----------------------------------------------------------------------
      // Testimonials
      // -----------------------------------------------------------------------
      {
        type: "testimonials",
        props: {
          title: "Відгуки клієнтів",
          items: [
            {
              quote:  "Замовила весільний букет — він перевершив усі очікування. Дякую за увагу до кожної деталі!",
              author: "Ірина К.",
              role:   "наречена",
            },
            {
              quote:  "Швидко доставили букет мамі на ювілей. Квіти свіжі, упаковка ідеальна. Рекомендую!",
              author: "Максим Р.",
            },
            {
              quote:  "Оформляли корпоратив у нашому офісі — результат просто чудовий. Колеги були в захваті.",
              author: "Оксана М.",
              role:   "керівниця відділу маркетингу",
            },
          ],
        },
        anchor:    "#testimonials",
        navLabel:  "Відгуки",
        showInNav: true,
        hidden:    false,
      },

      // -----------------------------------------------------------------------
      // Contacts (textual info + one-tap messenger buttons)
      // -----------------------------------------------------------------------
      {
        type: "contacts",
        props: {
          title:    "Контакти",
          phone:    "+38 (067) 123-45-67",
          address:  "вул. Сербська, 15, Львів, 79000",
          hours:    "Пн–Пт: 9:00–19:00, Сб–Нд: 9:00–17:00",
          email:    "info@kvity.lviv.ua",
          viber:    "+38 (067) 123-45-67",
          telegram: "@kvity_lviv",
        },
        anchor:    "#contacts",
        navLabel:  "Контакти",
        showInNav: true,
        hidden:    false,
      },
    ],
  },
];

import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignPack } from "@/lib/design/packs";

/**
 * Fixture content for the design-pack preview pages: one realistic block of
 * every type, skinned by the pack under preview. Images are permanent
 * generated assets already living in our public bucket.
 */
const IMG_ROSE =
  "https://bsaenssjxsaopspubufd.supabase.co/storage/v1/object/public/photos/generated/cfce179a-1a09-44c7-adbd-499451d2c5b4.png";
const IMG_WHEAT =
  "https://bsaenssjxsaopspubufd.supabase.co/storage/v1/object/public/photos/generated/ff277c07-e1b0-4c63-adc7-9e072ed27dc8.png";
const IMG_CARPET =
  "https://bsaenssjxsaopspubufd.supabase.co/storage/v1/object/public/photos/generated/4e2ee556-8941-4d87-be91-08024999d4a6.png";

/**
 * Raw fixture content (type + props), one realistic block of every type. Shared
 * by BOTH previews: the pack preview skins each block; the template preview
 * assigns each a `section` id instead (see admin/templates/fixture.ts).
 */
export const fixtureContent = [
    {
      type: "hero",
      props: {
        eyebrow: "Львів · вул. Прикладна, 1",
        title: "Сайт, що приводить",
        titleAccent: "клієнтів",
        subtitle: "Підзаголовок: коротке ціннісне повідомлення для клієнта у два рядки.",
        imageUrl: IMG_ROSE,
        ctaLabel: "Головна дія",
        secondaryCtaLabel: "Друга дія",
      },
    },
    {
      type: "richText",
      props: {
        title: "Про нас",
        body: "Абзац розповіді про бізнес.\n\nДругий абзац — підхід, досвід і чому нам довіряють.",
        align: "center",
      },
    },
    {
      type: "services",
      props: {
        title: "Послуги та ціни",
        items: [
          { name: "Базова послуга", description: "Короткий опис базової послуги.", price: "500 грн", icon: "check" },
          { name: "Популярна послуга", description: "Найчастіший вибір клієнтів.", price: "900 грн", badge: "Популярне", icon: "star", imageUrl: IMG_WHEAT },
          { name: "Преміум пакет", description: "Максимальний результат і супровід.", price: "1500 грн", icon: "award", imageUrl: IMG_CARPET },
        ],
      },
    },
    {
      type: "switchback",
      props: {
        items: [
          {
            heading: "Історія у форматі фото + текст",
            body: "Розповідь із зображенням поруч — про майстерню, команду чи процес.",
            imageUrl: IMG_WHEAT,
            buttonLabel: "Дізнатись більше",
          },
        ],
      },
    },
    {
      type: "stats",
      props: {
        items: [
          { value: "8 років", label: "на ринку" },
          { value: "1200+", label: "клієнтів" },
          { value: "4.9", label: "середня оцінка" },
        ],
      },
    },
    {
      type: "testimonials",
      props: {
        title: "Відгуки",
        items: [
          { quote: "Неймовірний сервіс — рекомендую всім знайомим!", author: "Олена К.", role: "клієнтка" },
          { quote: "Швидко, якісно і по-людськи.", author: "Ігор М." },
          { quote: "Повернусь ще не раз.", author: "Марія Д." },
        ],
      },
    },
    {
      type: "gallery",
      props: {
        title: "Наші роботи",
        images: [
          { url: IMG_ROSE, title: "Проєкт один", category: "Категорія" },
          { url: IMG_WHEAT, title: "Проєкт два", category: "Категорія" },
          { url: IMG_CARPET },
        ],
      },
    },
    {
      type: "faq",
      props: {
        title: "Питання й відповіді",
        items: [
          { question: "Як зробити замовлення?", answer: "Залиште заявку у формі — ми передзвонимо." },
          { question: "Які терміни виконання?", answer: "Зазвичай 1–3 робочі дні залежно від обсягу." },
          { question: "Чи є гарантія?", answer: "Так, на всі роботи діє гарантія." },
        ],
      },
    },
    {
      type: "cta",
      props: {
        title: "Готові почати?",
        subtitle: "Залиште заявку — відповімо протягом години.",
        buttonLabel: "Залишити заявку",
      },
    },
    {
      type: "lead_form",
      props: {
        title: "Залишити заявку",
        subtitle: "Заповніть форму — і ми звʼяжемось з вами найближчим часом.",
        buttonLabel: "Надіслати заявку",
      },
    },
    {
      type: "contacts",
      props: {
        title: "Контакти",
        phone: "+380671234567",
        address: "вул. Прикладна, 1, Львів",
        hours: "Пн–Сб 9:00–19:00",
        telegram: "example",
      },
    },
    {
      type: "team",
      props: {
        title: "Наша команда",
        items: [
          { name: "Олена Коваль", role: "Засновниця", bio: "10 років у сфері, авторка методики." },
          { name: "Ігор Мельник", role: "Провідний майстер" },
          { name: "Марія Дідух", role: "Адміністраторка" },
        ],
      },
    },
    {
      type: "timeline",
      props: {
        title: "Наш шлях",
        items: [
          { period: "2016", title: "Заснування", description: "Відкрили першу майстерню." },
          { period: "2020", title: "Розширення", description: "Друга локація й нова команда." },
          { period: "2024", title: "Сьогодні", description: "1200+ задоволених клієнтів." },
        ],
      },
    },
    {
      type: "marquee",
      props: {
        items: [
          "Якість",
          "Досвід",
          "Гарантія",
          "Індивідуальний підхід",
          "Сучасне обладнання",
          "Чесні ціни",
          "Швидко",
          "Надійно",
        ],
      },
    },
    {
      type: "publications",
      props: {
        title: "Праці",
        items: [
          { title: "Практичний посібник", subtitle: "друге видання", year: "2022", source: "Видавництво «Приклад»" },
          { title: "Стаття у фаховому журналі", year: "2021", source: "Журнал «Практика»" },
          { title: "Методичні рекомендації", year: "2019" },
        ],
      },
    },
    {
      type: "map",
      props: {
        title: "Як нас знайти",
        address: "м. Львів, вул. Прикладна, 1",
      },
    },
    {
      type: "instagram_cta",
      props: {
        title: "Ми в Instagram",
        subtitle: "Свіжі роботи щодня і швидкі відповіді в Direct.",
        handle: "example.studio",
        followersCount: 2400,
        buttonLabel: "Написати в Direct",
      },
    },
  ];

export function fixtureBlocks(pack: DesignPack): StoredBlock[] {
  const skin = (type: string) => {
    const s = pack.skins[type as keyof DesignPack["skins"]];
    return s || undefined;
  };
  const base = { showInNav: false, hidden: false };
  return fixtureContent.map((b) => ({ ...b, ...base, skin: skin(b.type) })) as unknown as StoredBlock[];
}

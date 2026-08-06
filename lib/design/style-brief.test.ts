import { describe, expect, it } from "vitest";
import { buildStyleBrief } from "./style-brief";
import { getVertical } from "@/lib/verticals/registry";

describe("buildStyleBrief", () => {
  const bakery = getVertical("bakery");

  it("carries the facts, the niche knowledge and the composed sections", () => {
    const brief = buildStyleBrief({
      facts: {
        businessName: "Мед і Хміль",
        city: "Львів",
        about: "Сімейна пекарня на заквасці.",
        services: [{ name: "Торти на замовлення" }, { name: "Свіжий хліб" }],
      },
      vertical: bakery,
      sectionTypes: ["hero", "services", "gallery", "lead_form", "contacts"],
    });

    expect(brief).toContain("Мед і Хміль, Львів");
    expect(brief).toContain(bakery.label);
    expect(brief).toContain(bakery.personaHint);
    expect(brief).toContain(bakery.genHint);
    expect(brief).toContain("Сімейна пекарня на заквасці.");
    expect(brief).toContain("Торти на замовлення, Свіжий хліб");
    // Section ids are translated to the block library's Ukrainian names.
    expect(brief).toContain("Головний банер → Послуги → Галерея → Форма заявки → Контакти");
    expect(brief).toContain("форми заявки"); // the funnel guidance line
  });

  it("caps the service list at eight", () => {
    const brief = buildStyleBrief({
      facts: {
        businessName: "СТО Драйв",
        city: "Київ",
        services: Array.from({ length: 12 }, (_, i) => ({ name: `Послуга ${i + 1}` })),
      },
      vertical: getVertical("autoservice"),
    });
    expect(brief).toContain("Послуга 8");
    expect(brief).not.toContain("Послуга 9");
  });

  it("degrades to the bare minimum when only name and city are known", () => {
    const brief = buildStyleBrief({
      facts: { businessName: "Ромашка", city: "Одеса" },
      vertical: getVertical("generic"),
    });
    expect(brief).toContain("Ромашка, Одеса");
    expect(brief).not.toContain("Про бізнес:");
    expect(brief).not.toContain("Послуги:");
    expect(brief).not.toContain("Секції сторінки");
  });

  it("does not repeat a section name when the page carries the block twice", () => {
    const brief = buildStyleBrief({
      facts: { businessName: "Ромашка", city: "Одеса" },
      vertical: getVertical("generic"),
      sectionTypes: ["hero", "services", "services", "contacts"],
    });
    expect(brief).toContain("Головний банер → Послуги → Контакти");
  });
});

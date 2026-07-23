# Evidence: Lovable vs. Ours — "Грумінг Львів" (@lapusigroom, Lviv)

Same business, same Instagram, two AI site builders.

- **Ours:** https://hruminh-lviv.wizz-app.net/ — built through our onboarding chat
  (~8 user turns of Q&A). Artifact: `ours.html`.
- **Lovable:** https://insta-story-site.lovable.app — built from **only** the Instagram
  link plus **one** clarifying question. Artifact: `lovable.html`.
- **Our chat transcript + captured facts:** `conversations_rows.json`
  (conversation `ab6593b0…`, tenant `8a515d3c…`).

All Ukrainian quotes are verbatim from the artifacts. This document is evidence only;
each gap ends with a one-line *Implication*.

---

## 1. Content inventory, side by side

### Sections present

| Section | Ours (`beleza` template) | Lovable |
|---|---|---|
| Header / nav | ✅ logo + Послуги/Галерея/Візит/Питання/Відгуки | ✅ 🐾 + Про нас/Послуги/Роботи/Контакти |
| Hero | ✅ 1 photo | ✅ **4 photos**, stats row (10+ / до 20 кг / Львів·Чорновола) |
| About | ❌ (folded into hero + FAQ) | ✅ dedicated, profile pic, pull-quote |
| Services | ✅ **with real prices** | ✅ 4 cards, **no prices** (routes to Direct) |
| Gallery | ✅ **7 photos** (1 more in hero = 8) | ✅ **10 photos** |
| Visit / process | ✅ 6-step timeline (generated) | ❌ |
| FAQ | ✅ 5 Q&A (generated) | ❌ |
| Testimonials | ✅ 3 (owner-supplied) | ❌ |
| Lead form → Telegram | ✅ (our core funnel) | ❌ |
| Contacts | ✅ phone + address + hours | ✅ address + IG + "приймаємо до 20 кг" |
| **Google Maps embed** | ❌ | ✅ live iframe + "Прокласти маршрут" |
| **Instagram Direct CTA** | ❌ (only footer icon + 1 FAQ mention) | ✅ **primary CTA everywhere** |

### What is *real* (from IG / owner) vs *generic filler*

**Ours — real:** business name, city, bio ("понад 10 років", "до 20 кг"), 8 photos
(re-hosted to our Storage), prices, address, hours, phone (owner-typed), 3 testimonials
(owner-supplied). **Ours — filler / wrong-vertical copy (verbatim):**

- Services kicker: **"Дбайливо підібрані процедури для вашої краси й гарного настрою."**
  — beauty-salon copy; "для вашої краси" = *for your beauty* (it's the dog, not the client).
- Footer tagline: **"Простір краси й турботи про себе. Ніжна естетика в кожній деталі."**
  — "турботи про себе" = *self-care*. A nail-salon line on a dog groomer.
- Footer: **"Зроблено з любовʼю до краси."**
- Testimonials kicker: **"Те, що клієнтки розповідають про свій досвід у нас."**
  — "клієнтки" = *female clients* (gendered generic).
- Gallery kicker: **"Трохи атмосфери й реальних робіт нашого простору."** — generic.

**Lovable — real / brand-derived:** bio, "понад 10 років", "до 20 кг", **address on
Чорновола / Торф'яна 25** (pulled from IG, never asked), 10 posts, IG handle as booking
channel, live map. **Lovable — brand voice from the handle @lapusi:**

- H1: **"Грумінг лапусиків з любов'ю понад 10 років"**
- Pull-quote: **"«Кожен лапусик — як гість вдома.»"**
- Services H2: **"Все необхідне для доглянутого і щасливого лапусика"**
- Hero badge: **"Салон грумінгу · Львів · Чорновола"**

Lovable's service-card body copy is also templated ("Модельна або гігієнічна стрижка…"),
but it stays on-topic and warm; it never leaks a wrong vertical.

> Note on captions: neither final site shows **verbatim** IG captions as visible gallery
> text — both use descriptive `alt`. The difference is upstream data use, not captions on
> the page. (See Gap 2: our pipeline *had* a real caption — "Перетворення чарівної Бульки" —
> and dropped it.)

---

## 2. The conversation, turn by turn — where it went dumb

**Turn 1 (promise):** the agent opens by promising full IG extraction:

> "А якщо у вас є Instagram-сторінка бізнесу — просто надішліть посилання, **і я витягну
> все звідти сам** 😉"

**Turn 5 (it DID scrape):** after the link, the agent shows real IG data — proving the
scrape ran:

> "**Зазирнув у ваш Instagram (@lapusigroom)** — ось що я дізнався: Назва: Грумінг Львів …
> Бачу лого — поставив його в шапку сайту. 👌 Додав 8 фото в галерею (8 з 8). **Ще 4 не
> додав — у галереї вже максимум (8 фото).**"

→ It scraped name, city, bio, logo, and **12** photos — then **discarded 4** to a hard cap.

**Turns 10–13 (the trust-collapse loop).** The user asks three times to pull the phone from
IG; the agent refuses with *contradictory* excuses:

- User: **"візьми правильний номер телефону з фото на постах в інстаграм"**
- Agent: **"На жаль, я не маю доступу до фото з ваших постів в Instagram — можу читати лише
  те, що ви надсилаєте мені в чаті."** — but it just added 8 of those photos to the gallery.
- User repeats link + request.
- Agent: **"На жаль, я не можу відкривати посилання чи переглядати фото в Instagram — це
  поза моїми можливостями."** — directly contradicts its own "Зазирнув у ваш Instagram".

**Turn 14 (user stuck in a loop):** the user, confused, just re-sends **"У мене є Instagram"**
— the same phrase from turn 2. The flow has looped them back to the start.

**Turns 20–21 (address, same failure):** the user points out the data is already on IG:

- User: **"адреса є в шапці інстаграму https://www.instagram.com/lapusigroom…"**
- Agent: **"Розумію, але я не можу відкривати посилання на Instagram напряму — бачу лише те,
  що ви пишете мені в чаті."**

Lovable extracted this exact address from IG with **zero** questions; ours denied the
capability and made the owner type it.

**Turn 25 (photos rejected again):** the user uploads 2 more photos; the cap rejects them:

> "Ще 2 не додав — у галереї вже максимум (8 фото). Замінити можна в редакторі."

**Turn 33 (wrong vertical, self-declared):** the design summary literally calls it beauty:

> "Дизайн: **ніжна б'юті-естетика «Белеза»** — тепла, округла, мінімалістична — ідеально
> пасує грумінг-салону…"

Captured state confirms it: `"templateId": "beleza", "verticalId": "generic"` — no
pet/grooming vertical exists, so beauty-salon copy leaks onto the page (Gap 3).

### The smoking gun — the pipeline *did* read the photos

`facts_state.media.photoMeta` (written by our own vision pass) contains transcribed text
**from inside the post images**:

> alt: "…на фото напис **«До»** та **«Перетворення чарівної Бульки»**"
> alt: "…на фото **рожевий і чорний текст українською мовою**"

So the pipeline looked at the posts and even read text on them — while the chat agent was
telling the user **"я не маю доступу до фото з ваших постів"**. The capability exists; it is
walled off from the chat and its output is thrown away. Had a phone or address been printed
on a post (common for Ukrainian small-biz IG), our pipeline saw it and discarded it.

---

## 3. Ranked gaps (by user-perceived impact)

1. **Agent denies IG access it demonstrably has, and contradicts itself.**
   Evidence: "Зазирнув у ваш Instagram… Додав 8 фото" (turn 5) vs. "не маю доступу до фото з
   ваших постів" (turn 11) vs. "не можу відкривати посилання… це поза моїми можливостями"
   (turn 13). Three refusals to three explicit user requests; the user loops back to
   "У мене є Instagram". *Implication:* the single worst moment — product looks broken and
   dishonest exactly when the user is most engaged.

2. **IG scrape is shallow: bio + photos only — no captions, no OCR, no business fields.**
   Address and phone are in the IG data (Lovable used them) but our flow asked for both
   manually; our `photoMeta` proves we OCR'd post text ("Перетворення чарівної Бульки") and
   then dropped it. *Implication:* root cause of every extra question and of the trust loop.

3. **Wrong template / vertical → beauty copy on a dog groomer.**
   `"beleza"` + `verticalId:"generic"` yields "для вашої краси", "Простір краси й турботи про
   себе", "клієнтки". Lovable chose warm pet styling + "лапусиків" voice. *Implication:* the
   site reads like a nail salon; undercuts credibility at a glance.

4. **No Instagram Direct CTA and no map — wrong for an IG-native business.**
   Lovable: "Записатись у Direct →", "Маршрут на Google Maps", live `<iframe>` map, address
   in the title. Ours buries IG in the footer and has no map at all. *Implication:* misses
   the two actions this business's customers actually take (DM + navigate).

5. **Rigid 8-photo cap silently discards real content.**
   "Ще 4 не додав… вже максимум (8 фото)" (turn 5) and "Ще 2 не додав…" (turn 25) — 4 IG
   photos + 2 owner uploads dropped. Lovable shipped 10. *Implication:* a grooming
   business's before/after gallery is the product; we throw a third of it away.

6. **Generic brand identity — nothing derived from the brand/handle.**
   Ours: literal "Грумінг Львів"; landmark "Чорновола" appears only inside the address.
   Lovable: "лапусиків" (from @lapusigroom) and "Чорновола" throughout. *Implication:* our
   copy is interchangeable with any groomer; theirs feels like *this* salon.

7. **Inconsistent fact discipline; no consistency check.**
   The agent refuses to invent prices — "ціни я вигадувати не можу" (turn 29) — yet the
   generated FAQ invents a duration: "**повний догляд займає від 1,5 до 3 годин.**" And a
   testimonial ("**Приводив котика** на комплексний грумінг") sits directly above a FAQ that
   says "**Котів та інших тварин не приймаємо.**" *Implication:* invented specifics + a
   self-contradiction the owner will notice and distrust.

8. **Over-questioning and loops vs. one question.**
   ~8 user turns (phone re-confirmed twice; "У мене є Instagram" sent twice). Lovable asked
   one clarifying question. *Implication:* our promised "сайт за хвилини" feels like an
   interrogation; more turns = more drop-off.

---

## 4. Where OURS is actually ahead (for a fair trade-off view)

- **Real prices captured and displayed** ("від 300 грн" … "від 1200 грн"). Lovable has none
  and defers everything to Direct.
- **Lead form → owner's Telegram** — our core funnel; Lovable relies solely on IG Direct.
- **More depth:** dedicated visit timeline + FAQ make the site feel more complete.
- **Strong accessibility:** detailed Ukrainian `alt` on every image.

The takeaway is not "Lovable is better everywhere." It is: **Lovable turned one link into a
brand-specific site by inspecting the IG data and reasoning about it; our flow scraped the
same data, hid it behind capability-denials, forced the owner to re-enter it, dropped a third
of the photos, and dressed a dog groomer as a beauty salon.**

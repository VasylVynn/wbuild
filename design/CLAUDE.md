# 3minsite — Product UI design system («Небо і мед»)

AI website builder for small Ukrainian businesses. Audience: non-technical owners 45–60+, phone-first. Light theme ONLY. All copy Ukrainian. Tone: тепло + впевненість («здібний друг», не SaaS-адмінка). Anti-patterns: purple gradients, generic SaaS dashboards, dense admin UI, jargon.

## Direction B «Небо і мед»
- Canvas bg (behind frames): #ECEEF0
- Page bg: #F7F8F8 · surface: #FFFFFF · sunken: #EEF1F3
- Border: #E2E7EB · strong: #C9D2D9
- Text: #17242F · muted: #5A6B7A · faint: #8A99A6
- Primary (deep blue): #1B5BBF · hover #14489C · soft #E7EEF9
- Honey accent: #E9A23B · text-safe #9A6A12 · soft #FCF1DD
- Success: text #177E53 / bg #DFF2E9 · Warning: #8F6410 / #FAF0D9 · Danger: #C03A32 / #FBE9E7
- Telegram: #229ED9 (bg, white text) · dark #1787BD
- Fonts: headings + wordmark 'Unbounded' (500/600), body/UI 'Manrope' (400–800). Google Fonts, full Cyrillic.
- Wordmark: `3minsite` in Unbounded 600; the «3» in honey #E9A23B, rest #17242F.
- Type: h1 32 (mob 26–28), h2 24, h3 19, body 17, small 15, caption 13. Base 17px.
- Radius: controls 14, inputs 14, cards 20, sheets 28 (top), chips/buttons pill 999 or 16.
- Buttons: primary = blue #1B5BBF pill/16px radius, 56px tall, Manrope 700 18px white. Secondary = white, 1.5px border #C9D2D9. Quiet = transparent, muted. Min tap 48px.
- Shadow card: 0 1px 2px rgba(23,36,47,.05), 0 10px 30px rgba(23,36,47,.07)
- Chat: assistant bubble white + border, left, radius 20/20/20/6; user bubble #1B5BBF white text, right, radius 20/20/6/20.
- Telegram actions styled in Telegram blue #229ED9.

## Files
Tokens.dc.html · Components.dc.html · per-screen files (A Dashboard, B Chat ×3 variants, C Form, D Generating+Success, E My Sites, F Leads, G Editor, H Login). Each screen: mobile 390 + desktop 1440 frames on canvas (design_doc_mode=canvas), one-column flow on desktop. Frame caption style: monospace 12px uppercase #8A99A6.

## Source of truth for copy
Repo VasylVynn/wbuild — keep its Ukrainian copy verbatim where given (greeting, form labels, statuses «Опубліковано/Чернетка/Призупинено», toasts, confirm dialog text).

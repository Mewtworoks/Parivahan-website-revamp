---
version: alpha
name: Parivahan Sewa · Redesign
description: The visual language of an independent redesign concept for the learner's-licence journey — a state record, set properly.
colors:
  bg: oklch(0.951 0.021 88)
  surface: oklch(0.979 0.014 88)
  surface2: oklch(0.929 0.028 88)
  ink: oklch(0.232 0.019 62)
  ink2: oklch(0.402 0.019 62)
  muted: oklch(0.532 0.021 66)
  line: oklch(0.866 0.025 84)
  line2: oklch(0.771 0.033 84)
  brand: oklch(0.492 0.152 158)
  brandHi: oklch(0.424 0.145 158)
  brandSoft: oklch(0.944 0.048 160)
  brandLine: oklch(0.821 0.088 158)
  teal: oklch(0.512 0.118 202)
  saffron: oklch(0.702 0.168 62)
  fieldInk: oklch(0.972 0.012 90)
  warn: oklch(0.585 0.132 62)
  bad: oklch(0.475 0.158 28)
typography:
  sans:
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif'
    fontSize: 1rem
    lineHeight: 1.55
    fontWeight: 400
    letterSpacing: normal
  display:
    fontFamily: '"IBM Plex Serif", Georgia, serif'
    fontSize: 1.5rem
    lineHeight: 1.15
    fontWeight: 600
    letterSpacing: -0.014em
  mono:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: 0.72rem
    lineHeight: 1.4
    fontWeight: 500
    letterSpacing: 0.1em
rounded:
  r: 5px
  rLg: 7px
  pill: 999px
---

## Overview

The service is a government record set on cream paper, in a green that carries
some voltage: warm cream grounds rather than screen-white, ink rather than
blue-black, figures that line up in a column, and colour on the two surfaces big
enough to hold it — a pale mint-to-saffron gradient across the hero, a deep
teal-green one under the footer.

The identity this replaced was cobalt on blue-white with a soft shadow under
every panel — the house style of every government-technology product and every
generated landing page.

**On restraint.** An intermediate version of this system followed the quiet,
neutral, no-gradient discipline of a developer-tool design language and arrived
somewhere correct, defensible and grey. That discipline is a means. On a service
whose users are mostly sixteen to twenty-five, on phones, deciding in the first
two seconds whether this is worth their time, it stopped serving. Colour here is
load-bearing, and the restraint that survived — monospaced figures, one gradient
per surface and not per panel, saffron rationed to three places — survived
because it was doing work rather than because it was quiet.

The whole redesign lives in `Frontend/src/styles/redesign.css`, loaded after
`parivahan_extracted.css` and overriding it. Nothing in that file is edited, so
the identity reverts by deleting one import in `main.tsx`.

## Colors

Every neutral holds its hue near 85 so the greys stay warm. A single cool grey
in this palette reads as a mistake rather than as a variation.

Grounds are **cream, never white**. `surface` was briefly `oklch(0.995 0.004)` —
white with a rumour of warmth. Cards are cream a step up from the page, so a
card is the same material lit differently rather than a different material.

`brand` is the interface green — links, selected states, primary buttons.
`teal` exists so the green has somewhere to travel: a gradient between two tints
of one hue is a wash, between two hues it is a gradient. `saffron` is the second
voice, rationed to three places (the hero's emphasised word, the rule closing
each big surface, warnings).

**Chroma matters more than lightness for whether a colour reads as a colour.**
Two versions of this palette failed on that: a green field at chroma 0.088,
which is a neutral wearing a hue, and a neutral warm-grey dark theme, which is
the same mistake with the hue removed entirely. Every dark-theme neutral now
carries chroma around 0.03–0.04 at hue 172, and that is what makes the interface
read as lit rather than switched off.

**Green does not go under the licence card.** The hero was solid green once and
the card — the only photograph on the page — was green standing on green,
flattened into wallpaper. `.lic` is now deeper than either end of the hero
gradient. Figure and ground, in that order.

Blue is used nowhere. Retuning the token block was not enough — eleven rules
wrote a blue directly into themselves (the licence card gradient, the game
chrome, the sheet scrim, the selected-tile ring) and had to be overridden by
name.

## Themes

Dark mode is re-tuned warm rather than inherited. Neutrals move to hue ~70,
`field` drops to `oklch(0.338 0.118 162)`, and the brand green lifts to
`oklch(0.688 0.128 156)` so it survives on a dark ground.

The colour fields set their own foreground rather than reading theme tokens, so
the hero and footer look the same in both themes. This is deliberate: the first
attempt made the hero `surface`, which in dark mode is two steps off `bg` and
rendered the band as a large empty rectangle with type floating in it.

## Typography

Three faces, one superfamily. `display` (Plex Serif) for headings — Plex exists
because an institution commissioned a typeface to speak with, which is the
register a licence is in. `sans` (Plex Sans) for everything read as prose.
`mono` (Plex Mono) for two jobs and no others: **field labels** — eyebrows,
kickers, column headings, set uppercase and tracked — and **figures**.

Figures are tabular wherever they are data: fees, tokens, application numbers,
times, table cells. Prose keeps proportional numerals, because tabular figures
inside a sentence are too wide.

The hero headline caps at `3.35rem`, down from `4.2rem`. A serif reads larger at
the same size, and the old cap was a product-launch size on a page about a
government form.

## Layout

The shell is `clamp(1120px, 80vw, 1440px)` — it grows with the display rather
than stopping dead and leaving 700px of background down each side.

Section spacing is grouped, not metronomic. Uniform gaps make unrelated blocks
read as one undifferentiated scroll, which is the giveaway rhythm of a page
assembled from a template. Gaps say what belongs together: ~34px inside a group,
~64–72px at a genuine change of subject.

Both colour fields are full-bleed; everything else sits in the shell.

## Elevation & Depth

**Shadows are green, not grey.** A neutral shadow under a cream card on a cream
page is a smudge; tinted toward the brand hue, the same depth reads as light
falling on something coloured.

`--sh` is the resting depth on static panels; `--sh-lg` is for surfaces that
genuinely float — sheet, toast, dropdown, back-to-top pill — and for the licence
card, which is standing on the hero rather than floating over it.

`--sh` was `none` for a while, on the argument that a shadow every panel claims
is a claim that means nothing. That argument holds only when the ground and the
card differ enough in value to separate on their own; at the current cream-on-
cream it does not, and the shadow is doing what a border cannot. The failure to
avoid is the earlier one: removing shadows while leaving a blue-white ground,
which flattened the page completely.

The one material is the top bar — translucent, `blur(8px) saturate(175%)`, so
content passes under it instead of vanishing at a hard edge. Blur stays at 8px
because a `backdrop-filter` on a sticky element is recomputed every scrolled
frame across the full viewport width. Saturation is not optional: a plain blur
averages colour toward the middle, and with a green field at the top that
average is mud.

## Shapes

`5px` and `7px`. Nearly square, because forms and documents have corners. Pills
stay fully round where a thing is genuinely a chip or a token.

Focus is a `2.5px` solid brand outline at `2px` offset — squared to match, and
thick enough to survive on cream. It is never removed.

## Components

**Buttons.** Press feedback is `scale(0.97)` over 140ms. Nothing in the original
2285-line stylesheet had an `:active` state; every affordance answered on hover,
and hover does not exist on a phone, where most of these users are. Buttons also
carry `touch-action: manipulation` (kills the 300ms tap-delay) and a transparent
tap-highlight (the default grey box ignores border-radius).

**Buttons on a colour field** invert — cream fill, green text — so the single
primary is the strongest thing on the screen.

**Promise rows** pair a claim with the screen that checks it, action column
right, hairline between rows. They replaced two sections of six cards that
asserted and then separately offered proof.

**The hero** is orchestrated: kicker → headline → sentence → buttons staggered
60ms apart, 280ms each, transform and opacity only. The licence card arrives
*with* the sentence, not last, because it is the other half of the headline's
claim. The rule under the emphasised word draws in from the left — the delight
budget, spent once, on the most-looked-at element on the service.

## Do's and Don'ts

- **Do** put a new colour through the token block. **Don't** write a value into a
  rule; eleven blues survived a full palette change that way.
- **Do** put the gradient on the hero and the footer. **Don't** put one on a
  card, a button row or a panel — a gradient on every surface is not colour, it
  is noise. The primary button is the one small exception, because it is the
  single most important control on any screen.
- **Do** ground everything in cream. **Don't** reach for white; it was tried and
  it reads as an absence rather than a choice.
- **Do** set figures in mono and tabular. **Don't** set prose in tabular figures,
  and **don't** set a long paragraph in mono at all — the disclaimer spent a
  version in monospace and was unreadable.
- **Do** keep saffron rationed to three places: the hero's emphasised word, the
  rule closing each big surface, and warnings.
- **Don't** animate anything but `transform` and `opacity`; **don't** use
  `transition: all`, `ease-in` on UI, or `scale(0)` for an entrance.
- **Do** ship `prefers-reduced-motion` and hover gating with the motion itself,
  not after. Reduced motion swaps slides for cross-fades rather than switching
  animation off — with `both` fill, `animation: none` leaves elements that never
  arrive.
- **Don't** trust an alpha that looks right on a colour field. `oklch(1 0 0/.58)`
  on `field` measures under AA at label size; small tracked type needs more
  contrast than its size suggests, not less.
- **Don't** remove decoration without replacing what it was doing. The hero's
  gradient, dot-grid and glow orb all deserved to go, but they were carrying the
  band's entire visual weight, and taking them out left a void until a colour
  field replaced them.

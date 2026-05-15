# Design System: RoadSOS Emergency Response App
**Project Type:** Mobile Web Emergency Assistance Platform  
**Design Language:** Dark Glassmorphic + Bright Action Cards  
**Device Target:** Mobile-first (430px viewport max-width)

---

## 1. Visual Theme & Atmosphere

**Dark, Mission-Critical Glassmorphism**

The design embodies urgent, trustworthy emergency response through a two-layer visual hierarchy:
- **Dark Glass Layer** (#060E1C): The app shell and background use a deep navy-black with frosted glass effects (blur + semi-transparent overlays) to create a sense of focused clarity and technological sophistication
- **Bright Action Layer**: White contact cards and light modals pop against the dark background, ensuring critical information (phone numbers, service names, action buttons) is unmissable
- **Color-Coded Intent**: Emergency buttons (red #DC2626), success states (green #22C55E), warnings (amber #F59E0B), and primary actions (blue #1D4ED8) use high-contrast hues to guide user behavior
- **Animated Urgency**: Pulse, blink, and sonar animations on SOS buttons and alerts reinforce emergency context without being frantic

The overall effect: Modern, futuristic, yet immediately graspable—optimized for high-stress decision-making.

---

## 2. Color Palette & Roles

### Primary Action & Authority
- **Deep Cerulean (#1D4ED8)**: Primary buttons, SOS container backgrounds, active chips, core UI elements
- **Bright Sky Blue (#2563EB, #3B82F6)**: Button hovers, accents, secondary UI states
- **Soft Sky Blue (#93C5FD)**: Text accents, borders on glass elements

### Emergency & Urgency
- **Crimson Red (#DC2626)**: Emergency alerts, SOS buttons, critical warning banners, countdown states
- **Bright Red (#EF4444)**: Closed status dots, secondary alert text
- **Pale Pink (#FEF2F2)**: Background for "yes, injured" choice buttons

### Success & Confirmation
- **Emerald Green (#22C55E)**: "Open" status indicators, success animations
- **Darker Emerald (#10B981)**: Telemetry ping background
- **Light Mint (#F0FDF4)**: Background for "no issues" choice buttons

### Warnings & Ambient
- **Amber Gold (#F59E0B)**: Offline indicators, demo badges, warnings (not emergencies)
- **Golden (#FCD34D)**: Cached data notes
- **Light Cream (#FFF7ED)**: Alarm strip background

### Neutral Base
- **Deep Navy (#060E1C)**: App background, modal backdrop
- **Near-White (#FFFFFF)**: Contact cards, form backgrounds
- **Slate Gray (#94A3B8)**: Placeholder text, disabled states, secondary labels
- **Medium Gray (#64748B)**: Body text, tertiary information
- **Cool Gray (#475569)**: Form labels, subtle dividers

### Glass Overlay Tints
- **Semi-transparent White (rgba(255,255,255,0.06–0.09))**: Ghost pill backgrounds, light glass surfaces
- **Semi-transparent Blue (rgba(59,130,246,0.15))**: Glass buttons, tinted modals
- **Blue-tinted Dark (rgba(30,41,59,0.4–0.5))**: Secondary glass buttons, disabled states

---

## 3. Typography Rules

**Font Family:** System stack prioritizing platform native fonts for familiarity and speed
```
-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif
```

**Monospace for Numbers:**
```
'SF Mono', 'Fira Code', 'Consolas', monospace
```
*Used exclusively for phone numbers, coordinates, counts to enhance scannability and reduce cognitive load*

### Weight & Size Hierarchy

| Context | Weight | Size | Usage |
|---------|--------|------|-------|
| **Labels** | 600 | 11px | Section headers, chip text, status labels (UPPERCASE, 0.1em letter-spacing) |
| **Body Text** | 400 | 13–14px | Descriptions, explanations, secondary content |
| **Small Labels** | 500 | 11–12px | Service status, distances, metadata |
| **Subheadings** | 600 | 15px | Triage question text, card titles |
| **Headings** | 700 | 17–22px | Page titles, modal titles, emphasis text |
| **Numbers** | 700–800 | 16–26px | Phone numbers (monospace), service names, emergency codes |
| **Emphasis** | 800–900 | 18–24px | "DO NOT PANIC", big countdown, impact text |

**Letter Spacing:** 
- Uppercase labels: +0.1em
- Headlines: -0.2 to -0.4px (slightly tighter for impact)
- Standard: -0.3px for brand, 0 for body

---

## 4. Component Stylings

### Buttons

#### Primary Action (Get Help, SOS, Send)
- **Shape:** Rounded to 15px (generously curved, nearly pill-shaped for prominent buttons)
- **Height:** 56px (generous touch target)
- **Background:** Solid blue (#1D4ED8) or glassmorphic blue (rgba(29,78,216,0.6) with backdrop-filter: blur(12px))
- **Hover:** Brightens to #2563EB
- **Active:** Scales down 0.98 with shadow reduction
- **Disabled:** Gray (#94A3B8) with no shadow
- **Animation:** Subtle spring scaling on active state with cubic-bezier(.34,1.56,.64,1)

#### Pill Buttons (Header, Filters)
- **Shape:** Fully rounded (border-radius: 999px)
- **Padding:** 6–11px horizontal, 6px vertical
- **Font:** 12px, 500 weight
- **Background:** Ghost (rgba(255,255,255,0.06)) or solid color
- **Border:** 1px semi-transparent
- **Transition:** 0.15s opacity on active

#### SOS Glass Button (Hero Action)
- **Shape:** Pill-shaped (border-radius: 50px)
- **Height:** 56px, max-width 260px
- **Background:** Glassmorphic blue (rgba(29,78,216,0.6) with blur(12px))
- **Border:** 1px rgba(255,255,255,0.2) (frosted glass edge)
- **Animation:** 
  - Blink: 2.5s infinite cycling shadow intensity and background brightness
  - Sonar pulse overlay: 2s scale animation with opacity fade (two rings with 1s stagger)
- **Shadow:** 0 8px 32px rgba(29,78,216,0.4)
- **Sent state:** Green glassmorphic, no animation

#### Secondary (Skip, Cancel, Dismiss)
- **Shape:** Rounded 12–15px
- **Background:** Transparent or light gray (F8FAFC) with borders
- **Text Color:** Gray (#94A3B8 or #64748B)
- **Hover:** Slight background brightening, no color change

### Cards & Containers

#### Service Card (Contact List)
- **Shape:** Rounded 14px on first/last child, squared edges between siblings
- **Background:** Pure white (#FFFFFF)
- **Border:** 1px divider between cards (F1F5F9)
- **Shadow:** None (clean, flat)
- **Content Padding:** 11–14px (horizontal), 11px top
- **Icon Background:** Subtly tinted, e.g., rgba(37,99,235,0.15) for ambulance
- **Call Button:** Light blue background (EFF6FF), blue border (BFDBFE), monospace phone number

#### National Emergency Card (2×2 Grid)
- **Shape:** Rounded 14px
- **Background:** Pure white
- **Border:** None, but left-side accent stripe (3px color bar)
- **Padding:** 13px horizontal, 12px vertical
- **Icon Box:** Rounded 9px, color-coded background (e.g., red for ambulance)
- **Number:** 26px bold monospace, tight letter-spacing (-1px)
- **Label:** 10px gray, 0.07em letter-spacing

#### Modal Sheet (Triage, Crash Alert)
- **Shape:** Rounded 24px at top, squared bottom
- **Background:** White (#FFFFFF)
- **Shadow:** 0 10px 50px rgba(0,0,0,0.5)
- **Max-width:** 430px (viewport-constrained)
- **Handle Bar:** 36px × 4px soft pill at top, E2E8F0 color
- **Padding:** 16–20px horizontal, 12–30px vertical

#### Glass Panel (SOS Dispatch, Telemetry Block)
- **Shape:** Rounded 12–16px
- **Background:** rgba(255,255,255,0.03–0.06) with backdrop-filter: blur(12px)
- **Border:** 1px rgba(255,255,255,0.08–0.09)
- **Shadow:** 0 10px 15px rgba(0,0,0,0.1)
- **Glow Effect:** Optional blue glow (blur(50px), opacity 0.2) in top-right corner
- **Text:** Light gray (#E2E8F0 for labels, #94A3B8 for metadata)

#### Choice Buttons (Yes/No, Response Cards)
- **Shape:** Rounded 13px
- **Height:** 52px
- **Border:** 2px (transparent by default)
- **Idle:** Light gray (F8FAFC) with slate border
- **Active (Yes):** Pink background (FEF2F2), red border (FCA5A5), red text
- **Active (No):** Blue background (EFF6FF), blue border (93C5FD), blue text
- **Icon:** Circle or filled circle (CheckCircle, XCircle from lucide-react)
- **Transition:** Spring cubic-bezier(.34,1.56,.64,1)

### Forms & Inputs

#### Text Input (PIN, Coordinates)
- **Shape:** Rounded 12px
- **Height:** 46px
- **Border:** 1.5px (E2E8F0 by default)
- **Background:** F8FAFC (light gray)
- **Focus:** Blue border (93C5FD), white background
- **Error:** Red border (FCA5A5), pink background (FEF2F2)
- **Success:** Green border (86EFAC), mint background (F0FDF4)
- **Font:** 18px monospace, centered, letter-spacing 6px

#### Dropdown / Select
- **Style:** Follows pill styling (bg: rgba(255,255,255,0.06), border: rgba(255,255,255,0.09))
- **Option Text:** White on dark background
- **Hover:** Brightened background

### Animations & Effects

#### Pulse (Location, Status)
- **Duration:** 2.5s ease-out infinite
- **Effect:** Box-shadow expands and fades (0 0 0 0 → 0 0 0 6px)
- **Color:** Blue accent (rgba(59,130,246,0.35))

#### Blink (Siren, Speaking, Alarms)
- **Duration:** 1–1.5s ease-in-out infinite
- **Effect:** Opacity oscillates 1 → 0.5 → 1
- **Use:** Status indicators that need attention but not frantic

#### Glass Blink (SOS Button)
- **Duration:** 2.5s infinite
- **Effect:** Cycles box-shadow intensity and background brightness
- **Peak:** 50% mark has brighter blue and enlarged shadow

#### Sonar Pulse (SOS Overlay Rings)
- **Duration:** 2s cubic-bezier(0,0,0.2,1) infinite
- **Effect:** Border scale 1 → 1.15, opacity 1 → 0
- **Rings:** Two staggered (1s delay on second)

#### Spin (Loading Spinner)
- **Duration:** 0.8s linear infinite
- **Effect:** Full 360° rotation, border-top color (#1D4ED8)

#### Text Blink ("DO NOT PANIC")
- **Duration:** 1.5s infinite
- **Effect:** Opacity + text-shadow pulse
- **Purpose:** Maximum attention for critical state

---

## 5. Layout Principles

### Viewport & Container
- **Max-width:** 430px (mobile phone form factor)
- **Padding:** 16px horizontal throughout (except sticky header)
- **Safe area:** 120px bottom padding for floating SOS button

### Spacing Strategy
- **Micro (4–8px):** Icon-to-text gaps, label underlines
- **Small (10–12px):** Button padding, card gaps
- **Medium (14–18px):** Section padding, between major components
- **Large (24–32px):** Page vertical rhythm, modal padding
- **XL (52px+):** Full section heights

### Header
- **Sticky:** Position fixed, z-index 50
- **Padding:** 52px top (system status bar), 12px bottom
- **Border:** 1px rgba(255,255,255,0.05) bottom
- **Content:** Brand (icon + name) left, actions (pills) right
- **Alignment:** Flex center, space-between

### Grid Systems
- **2×2 National Emergency:** grid-template-columns: 1fr 1fr, gap: 8px
- **Choice Buttons:** grid-template-columns: 1fr 1fr, gap: 8px
- **Service List:** Flex column, gap: 1px (creates appearance of stacked cards)

### Sticky Elements
- **SOS Button Container:** Sticky, top: 16px, padding: 0 16px 16px
- **Header:** Sticky, top: 0, z-index: 50

### Section Structure
- **Section Head:** Padding 18px 16px 10px, flex between title and note
- **Section Body:** Padding 0 16px (minus card internal padding)
- **Dividers:** 1px F1F5F9 (light gray)

---

## 6. Key Design Patterns

### The Glass + Light Duality
- **Dark Glass** (app shell, modals, overlays) creates focus and sophistication
- **White/Light** (cards, inputs, action surfaces) ensures readability and action clarity
- **Semi-transparent overlays** (rgba layers with blur) bridge the two without harsh transitions

### Monospace Numbers for Scanning
All numeric content (phone numbers, coordinates, counts) uses monospace font with tight letter-spacing to enable rapid visual parsing in emergencies.

### Color as Language
Every color conveys intent: blue = action, red = emergency, green = good, amber = caution. Users learn this language immediately.

### Animation as Attention
Animations (pulse, blink, sonar) escalate with urgency:
- Calm pulse = location active
- Steady blink = status change
- Glass blink + sonar = SOS active (maximum attention)

### Typography Hierarchy by Weight
Scanning happens first by weight (100% scan 800–900), then size. This allows users to skim critical numbers without reading surrounding context.

---

## 7. Accessibility & Contrast

- **WCAG AA Compliant:** All text meets 4.5:1 contrast ratios (white text on dark glass, dark text on white cards)
- **Focus States:** 1.5px blue border on all interactive elements
- **No Color-Only Information:** All status (open/closed) includes text labels and icons, not just color
- **Touch Targets:** Minimum 44×44px for buttons (56px SOS button)
- **Reduced Motion:** No forced animations; animations use standard easing curves

---

## 8. Implementation Notes for Claude Design Refinements

When using Claude Design tools to enhance this system:

1. **Preserve the glass aesthetic:** Any new screens should maintain the dark shell + light card duality
2. **Respect the color language:** Emergency = red, action = blue, success = green
3. **Monospace for numbers:** Never break this pattern; it's cognitive
4. **Rounded > sharp:** Minimum 12px border-radius for friendly feel; 999px for pills
5. **Animations serve urgency:** All motion should reinforce the emergency context
6. **Typography hierarchy by weight:** Use the 400→700→800→900 progression
7. **Padding discipline:** Stick to 16px horizontal, 12–14px card internal padding
8. **Mobile-first:** All designs max 430px width; assume 812px height (iPhone SE footprint)

---

**Design System Version:** 1.0  
**Last Updated:** May 2026  
**Steward:** Arindam (Original Creator & Visual Architect)

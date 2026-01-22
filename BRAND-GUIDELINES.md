# PageSwipe Brand Guidelines

**Version:** 1.0
**Last Updated:** 2026-01-21
**Status:** Official - All platforms must conform to these specifications

---

## Overview

These brand guidelines ensure visual consistency across all PageSwipe platforms: iOS app, Web app, marketing pages, and any future extensions. All new features, pages, and components MUST reference this document.

---

## Logo

### Primary Logo
- Open book icon with two pages spreading outward
- Left page: Teal gradient
- Right page: Coral gradient
- Upward arrow: Coral/orange emerging from center spine
- White binding/spine separator

### Logo Usage
- Minimum clear space: Height of the arrow on all sides
- Never stretch, rotate, or alter colors
- Use on white/light backgrounds or dark backgrounds with sufficient contrast

### Wordmark
- Text: "PageSwipe"
- Color: Navy (`#1E3A5F`) on light backgrounds, White on dark backgrounds
- Font: Nunito Bold (or system rounded on iOS)

---

## Color Palette

### Primary Brand Colors

These colors are extracted directly from the logo and must be used consistently.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Teal** | `#2DB3A0` | rgb(45, 179, 160) | Left page, positive actions, success states, secondary buttons |
| **Coral** | `#F2786D` | rgb(242, 120, 109) | Right page, primary CTAs, accent highlights, attention |
| **Navy** | `#1E3A5F` | rgb(30, 58, 95) | Text, headings, navigation, tertiary buttons |

### Extended Palette

| Name | Hex | Usage |
|------|-----|-------|
| Teal Light | `#E6F5F3` | Backgrounds, hover states, subtle highlights |
| Teal Dark | `#238F80` | Pressed states, emphasis, dark mode adjustments |
| Coral Light | `#FDEAE8` | Backgrounds, notifications, alerts |
| Coral Dark | `#D65A4F` | Pressed states, emphasis |
| Navy Light | `#E8EDF3` | Subtle backgrounds, borders |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success | `#10B981` | Confirmations, completed states, positive feedback |
| Warning | `#F59E0B` | Cautions, pending states, attention needed |
| Error | `#E85A4F` | Errors, destructive actions (uses logo arrow color) |

### Neutral Scale

| Name | Hex | Usage |
|------|-----|-------|
| White | `#FFFFFF` | Backgrounds, text on dark |
| Gray 50 | `#F8FAFC` | Page backgrounds |
| Gray 100 | `#F1F5F9` | Card backgrounds, subtle fills |
| Gray 200 | `#E2E8F0` | Borders, dividers |
| Gray 300 | `#CBD5E1` | Disabled states, placeholders |
| Gray 400 | `#94A3B8` | Secondary text, icons |
| Gray 500 | `#64748B` | Body text (secondary) |
| Gray 600 | `#475569` | Body text (primary on light) |
| Black | `#0F172A` | Headings on light backgrounds |

### Dark Mode Colors

| Light Mode | Dark Mode Equivalent |
|------------|---------------------|
| White (`#FFFFFF`) | `#0C1222` (background) |
| Gray 50 (`#F8FAFC`) | `#141E33` (surface) |
| Gray 100 (`#F1F5F9`) | `#1E293B` (elevated surface) |
| Gray 600 (`#475569`) | `#F1F5F9` (text) |
| Black (`#0F172A`) | `#FFFFFF` (headings) |
| Teal (`#2DB3A0`) | `#3DBFAD` (slightly lighter) |
| Coral (`#F2786D`) | `#F58B82` (slightly lighter) |

### Gradient

**Brand Gradient:**
```css
background: linear-gradient(135deg, #2DB3A0 0%, #F2786D 100%);
```

Use for: Premium features, special CTAs, decorative elements, logo text treatment on web.

---

## Typography

### Font Families

| Platform | Headlines | Body |
|----------|-----------|------|
| **Web** | Nunito (Google Fonts) | Inter (Google Fonts) |
| **iOS** | SF Pro Rounded | SF Pro Text |

### Font Loading (Web)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

### CSS Variables (Web)

```css
:root {
  --font-display: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### iOS Font Definitions

```swift
extension Font {
    // Headlines - use rounded design
    static func brandDisplay(_ size: CGFloat = 32) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    static func brandHeadline(_ size: CGFloat = 24) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    static func brandTitle(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }

    // Body - use default design
    static func brandBody(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
    static func brandCaption(_ size: CGFloat = 14) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
    static func brandSmall(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
}
```

### Type Scale

| Name | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| Display | 32px | 40px | Bold | Hero headlines, major page titles |
| Headline | 24px | 32px | Bold | Section headers, card titles |
| Title | 20px | 28px | Semibold | Subsection headers, modal titles |
| Body | 16px | 24px | Regular | Paragraphs, descriptions |
| Caption | 14px | 20px | Medium | Labels, metadata, secondary info |
| Small | 12px | 16px | Regular | Fine print, timestamps |

---

## Spacing System

Use consistent spacing based on a 4px grid.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Related element gaps |
| `--space-3` | 12px | Card internal padding |
| `--space-4` | 16px | Standard padding, gaps |
| `--space-5` | 20px | Section padding |
| `--space-6` | 24px | Large card padding |
| `--space-8` | 32px | Section margins |
| `--space-10` | 40px | Major section breaks |
| `--space-12` | 48px | Page margins |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small buttons, chips, tags |
| `--radius-md` | 8px | Input fields, small cards |
| `--radius-lg` | 12px | Cards, modals, buttons |
| `--radius-xl` | 16px | Large cards, featured content |
| `--radius-2xl` | 24px | Hero sections, major containers |
| `--radius-full` | 9999px | Pills, avatars, circular elements |

**iOS Note:** Use `.continuous` corner style for smooth corners.

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Feature highlights |
| `--shadow-teal` | `0 4px 14px rgba(45,179,160,0.35)` | Teal button glow |
| `--shadow-coral` | `0 4px 14px rgba(242,120,109,0.35)` | Coral button glow |

---

## Button Styles

### Primary Button (Coral)
Main calls-to-action: "Get Started", "Save Book", "Continue"

```css
.btn-primary {
  background: #F2786D;
  color: #FFFFFF;
  font-family: var(--font-display);
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 14px rgba(242, 120, 109, 0.35);
}
.btn-primary:hover {
  background: #D65A4F;
}
```

### Secondary Button (Teal)
Alternative actions: "View Details", "Share", "Learn More"

```css
.btn-secondary {
  background: #2DB3A0;
  color: #FFFFFF;
  font-family: var(--font-display);
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 14px rgba(45, 179, 160, 0.35);
}
.btn-secondary:hover {
  background: #238F80;
}
```

### Tertiary Button (Navy Outline)
Less prominent actions: "Cancel", "Back", "Skip"

```css
.btn-tertiary {
  background: transparent;
  color: #1E3A5F;
  font-family: var(--font-display);
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  border: 1.5px solid #1E3A5F;
}
.btn-tertiary:hover {
  background: #1E3A5F;
  color: #FFFFFF;
}
```

### Gradient Button (Premium)
Premium features, special promotions, upgrade CTAs

```css
.btn-gradient {
  background: linear-gradient(135deg, #2DB3A0 0%, #F2786D 100%);
  color: #FFFFFF;
  font-family: var(--font-display);
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
}
```

### Button Sizes

| Size | Padding | Font Size | Min Height |
|------|---------|-----------|------------|
| Small | 8px 16px | 14px | 36px |
| Medium | 12px 24px | 16px | 44px |
| Large | 16px 32px | 18px | 52px |

---

## Card Styles

### Standard Card

```css
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}
```

### Elevated Card

```css
.card-elevated {
  background: #FFFFFF;
  border: none;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### Interactive Card

```css
.card-interactive {
  /* Base card styles */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.12);
}
```

---

## iOS Color Definitions

Update `Colors.swift` to match these exact values:

```swift
extension Color {
    // Primary Brand Colors (from logo)
    static let brandTeal = Color(hex: "2DB3A0")
    static let brandCoral = Color(hex: "F2786D")
    static let brandNavy = Color(hex: "1E3A5F")

    // Extended Palette
    static let brandTealLight = Color(hex: "E6F5F3")
    static let brandTealDark = Color(hex: "238F80")
    static let brandCoralLight = Color(hex: "FDEAE8")
    static let brandCoralDark = Color(hex: "D65A4F")
    static let brandNavyLight = Color(hex: "E8EDF3")

    // Semantic Colors
    static let brandSuccess = Color(hex: "10B981")
    static let brandWarning = Color(hex: "F59E0B")
    static let brandError = Color(hex: "E85A4F")

    // Legacy aliases (for backward compatibility during transition)
    static let pagePrimary = brandTeal
    static let pageSecondary = brandCoral
    static let pageAccent = brandCoral
    static let pageDark = brandNavy
}
```

---

## Web CSS Variables

Add to root of all CSS files:

```css
:root {
  /* Primary Brand Colors */
  --color-teal: #2DB3A0;
  --color-coral: #F2786D;
  --color-navy: #1E3A5F;

  /* Extended Palette */
  --color-teal-light: #E6F5F3;
  --color-teal-dark: #238F80;
  --color-coral-light: #FDEAE8;
  --color-coral-dark: #D65A4F;
  --color-navy-light: #E8EDF3;

  /* Semantic Colors */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #E85A4F;

  /* Neutrals */
  --color-white: #FFFFFF;
  --color-gray-50: #F8FAFC;
  --color-gray-100: #F1F5F9;
  --color-gray-200: #E2E8F0;
  --color-gray-300: #CBD5E1;
  --color-gray-400: #94A3B8;
  --color-gray-500: #64748B;
  --color-gray-600: #475569;
  --color-black: #0F172A;

  /* Gradient */
  --gradient-brand: linear-gradient(135deg, #2DB3A0 0%, #F2786D 100%);

  /* Typography */
  --font-display: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
  --shadow-teal: 0 4px 14px rgba(45,179,160,0.35);
  --shadow-coral: 0 4px 14px rgba(242,120,109,0.35);
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0C1222;
    --color-surface: #141E33;
    --color-surface-elevated: #1E293B;
    --color-text: #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-border: #334155;

    /* Adjusted brand colors for dark mode */
    --color-teal: #3DBFAD;
    --color-coral: #F58B82;
    --gradient-brand: linear-gradient(135deg, #3DBFAD 0%, #F58B82 100%);
  }
}
```

---

## Component Patterns

### Logo Text Treatment

**Web:**
```css
.logo-text {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 24px;
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**iOS:**
```swift
Text("PageSwipe")
    .font(.system(size: 24, weight: .bold, design: .rounded))
    .foregroundStyle(
        LinearGradient(
            colors: [.brandTeal, .brandCoral],
            startPoint: .leading,
            endPoint: .trailing
        )
    )
```

### Navigation Header

- Background: White (light) / `#0C1222` (dark)
- Logo: Left-aligned with gradient text
- Links: Navy text, coral underline on hover
- CTA Button: Primary (coral) style

### Input Fields

```css
.input {
  font-family: var(--font-body);
  font-size: 16px;
  padding: 12px 16px;
  border: 1.5px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  background: var(--color-white);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.input:focus {
  border-color: var(--color-teal);
  box-shadow: 0 0 0 3px var(--color-teal-light);
  outline: none;
}
```

---

## Iconography

- Style: Outlined, 1.5px stroke weight
- Size: 20px standard, 24px for navigation, 16px for inline
- Color: Inherit from text or use brand colors for emphasis
- Recommended set: Heroicons, SF Symbols (iOS)

---

## Motion & Animation

### Timing Functions

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Standard Durations

| Type | Duration | Usage |
|------|----------|-------|
| Fast | 150ms | Hover states, button feedback |
| Normal | 250ms | Transitions, reveals |
| Slow | 400ms | Page transitions, modals |

### Hover Effects

- Buttons: Darken background 10-15%
- Cards: Lift 2-4px with increased shadow
- Links: Underline or color shift to coral

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Focus states: Visible outline using teal (`box-shadow: 0 0 0 3px #E6F5F3`)
- Touch targets: Minimum 44x44px
- Motion: Respect `prefers-reduced-motion`

---

## File Reference

When implementing new features, reference these files:

| Platform | File | Purpose |
|----------|------|---------|
| iOS | `Colors.swift` | Color definitions |
| iOS | `*.swift` views | Use `Font.brand*()` methods |
| Web | `app.css` | CSS variables and base styles |
| Web | `*.html` | Include font imports |
| All | `BRAND-GUIDELINES.md` | This document |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-21 | Initial brand guidelines established |

---

**Remember:** Consistency builds trust. When in doubt, reference this document.

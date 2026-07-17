---
description: Phase 0.5 (Deep Mapping)
---

# Phase 0.5: Deep Mapping & Estimation

> **This document is an engineering analysis artifact.**
>
> Its purpose is to reduce uncertainty before implementation.
> Any recommendations contained herein are provisional and require confirmation during the corresponding implementation phase.

This document provides a detailed mapping between the approved canonical design (Technology Portal: `RINK-TECH`) and the target implementation (Instrumentation Portal: `rink-frontend`), strictly conforming to the Abort Conditions and Frozen Responsibilities outlined in Phase 0. 

*No implementation decisions are locked in during this phase.*

## 1. File & Directory Mapping

| Responsibility | Source (RINK-TECH) | Target (rink-frontend) | Action / Constraint |
| --- | --- | --- | --- |
| **Global Styles** | `src/app/globals.css` | `src/app/globals.css` | Phase 1: Compare design tokens. Only introduce missing tokens necessary for visual parity. Do not replace existing project-specific tokens. |
| **Tailwind Config** | `tailwind.config.mjs` (or inline via v4) | `package.json` + CSS config | Phase 1: Compare design tokens (colors, spacing, typography, shadows, radius, animation constants). Introduce only missing tokens required for visual parity. Preserve existing project-specific tokens. |
| **Data Types** | `src/types/index.ts` | `src/types/instrument.ts` | **FROZEN**. Do not modify. |
| **Search Engine** | `src/lib/searchEngine.ts` | `src/lib/search/orama.ts` | **FROZEN**. Do not modify. |
| **State** | React hooks / URL queries | `src/store/useStore.ts` | **FROZEN**. Do not modify Zustand store. |
| **Routing** | `src/app/technologies/[id]` | `src/app/instrument/[id]` | **FROZEN**. Adapt layout only. |

## 2. Component Mapping (Presentation Layer)

The following UI mappings detail how Target components could potentially be visually migrated to match Source components without altering the underlying data model or state logic.

| Target Component (To be Modified) | Source Component Template (To Reference) | Notes / Refactoring Strategy |
| --- | --- | --- |
| `src/components/desktop/DesktopHome.tsx` | `src/app/page.tsx` (Hero + Grid) | Evaluate skinning the grid styling and hero banner. Maintain Search-First flow. |
| `src/components/mobile/MobileHome.tsx` | `src/app/page.tsx` (Responsive tailwind) | Evaluate aligning mobile spacing and card stacking. |
| `src/components/domain/InstrumentCard.tsx` | `src/components/ui/TechnologyCard.tsx` | Evaluate whether a shared `BaseCard` abstraction is appropriate during Phase 2. If not, preserve separate components while maintaining visual parity. |
| `src/components/mobile/MobileInstrumentCard.tsx`| `src/components/ui/TechnologyCard.tsx` | Evaluate aligning the mobile variant with the unified responsive `TechnologyCard`. |
| `src/components/domain/SearchBar.tsx` | `src/components/ui/HeroSearch.tsx` | Evaluate skinning the existing Orama/Zustand inputs with the Technology Portal's search field UI (icons, shadows, hover). |
| `src/components/domain/FilterSidebar.tsx` | `src/components/ui/FilterSidebar.tsx` | Evaluate skinning existing dynamic taxonomy filters with the Source's accordion/chip UI. |
| `src/components/mobile/MobileFilterModal.tsx` | `src/components/ui/FilterSidebar.tsx` (Mobile Drawer state) | Evaluate adopting Source's mobile drawer/sheet animation and layout. |
| `src/components/domain/GsapBackground.tsx` | `src/components/ui/EcosystemNetworkBackground.tsx` | **Analysis Result:** GSAPBackground performs the same visual responsibility as the Technology Portal background. **Recommendation:** Evaluate replacement during Phase 7 (Motion). No implementation decision is made in Phase 0.5. |
| `src/components/desktop/DesktopInstrumentDetails.tsx`| `src/app/technologies/[id]/page.tsx` | Evaluate adopting header hero, metadata grid, and rich text styling. |

## 3. Candidate Layout Adaptation

### Homepage Layout
- **Current Target:** Heavy GSAP background, split desktop/mobile renderers, search overlay.
- **Candidate Visual Adaptation:** Framer Motion particles/background (`InnovationAmbientLayer.tsx` style), visually-consistent desktop/mobile container padding, keeping the search-first dominance.

### Details Page Layout
- **Current Target:** Left-heavy image grid, right-side metadata.
- **Candidate Visual Adaptation:** Top hero banner spanning full width with title/institution, sticky sidebar for "Booking/Contact", and main scrollable column for Specifications/Documentation.

## 4. Proposed Shared Components

The following are candidates for shared UI primitives, subject to Phase 2 confirmation:
- `BaseCard`
- `StatusBadge`
- `SectionHeading`
- `CardSkeleton`

## 5. Complexity Assessment

| Phase | Description | Complexity |
| --- | --- | --- |
| **Phase 1** | Design System | Low |
| **Phase 2** | Shared Components | Medium |
| **Phase 3** | Home Page | High |
| **Phase 4** | Filters | High |
| **Phase 5** | Detail Page | High |
| **Phase 6** | Mobile | Medium |
| **Phase 7** | Motion | Medium |
| **Phase 8** | Polish | Low |

## 6. Confidence Matrix

| Mapping | Confidence |
| --- | --- |
| Search | High |
| Card | High |
| Detail Layout | Medium |
| Filters | High |
| Motion (Framer Motion) | High |
| GSAP Background Strategy | Low |
| Mobile | Medium |

## 7. Initial Expected Primary UI Files
*(This list highlights initial discovery, but additional presentation files may be discovered during execution)*

1. `src/app/globals.css`
2. `src/components/desktop/DesktopHome.tsx`
3. `src/components/mobile/MobileHome.tsx`
4. `src/components/domain/InstrumentCard.tsx`
5. `src/components/mobile/MobileInstrumentCard.tsx`
6. `src/components/domain/SearchBar.tsx`
7. `src/components/domain/FilterSidebar.tsx`
8. `src/components/mobile/MobileFilterModal.tsx`
9. `src/components/mobile/MobileFilterSheet.tsx`
10. `src/components/domain/ActiveFilters.tsx`
11. `src/components/desktop/DesktopInstrumentDetails.tsx`
12. `src/components/mobile/MobileInstrumentDetails.tsx`
13. `src/components/domain/GsapBackground.tsx`

## 8. Open Questions
Before writing code, the following unknowns must be addressed during their respective phases:
- Does GSAP provide functionality beyond visuals?
- Can Desktop/Mobile components remain entirely separate in the new layout, or will maintaining visual parity require merging them?
- Are there hidden components using old, undocumented design tokens?
- Do any domain components embed styling assumptions inside their business logic hooks?
- Are there any shared utility functions or custom hooks that implicitly encode UI behavior (spacing, animation timing, layout decisions) and therefore require review before migration?

---

## Deliverables Produced

Phase 0.5 produced:

- [x] Component Mapping
- [x] File Mapping
- [x] Layout Mapping
- [x] Shared Component Candidates
- [x] Complexity Assessment
- [x] Primary Files Inventory
- [x] Migration Constraints Validation

*No code has been modified.*

## Stop Gate: Phase 0.5 Review
The deep mapping is formally complete. **Please approve to begin Phase 1 — Design System.**

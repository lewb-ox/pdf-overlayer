---
name: PDF Overlayer
description: A translucent tracing desk for clearly marked architectural plans.
colors:
  green: "#276657"
  green-dark: "#1c4e41"
  green-light: "#e6eee7"
  paper: "#ffffff"
  on-accent: "#ffffff"
  surface: "#fbfaf7"
  canvas: "#eaece7"
  ink: "#293a32"
  muted: "#5c6962"
  line: "#dfe3dc"
  danger: "#a23e32"
  secondary-border: "#d4dacf"
  secondary-hover: "#efefe9"
  row-selected: "#e9efe7"
  row-selected-border: "#d5e1d2"
  tool-active-ink: "#235d4f"
  field: "#fffefa"
  field-border: "#d5dbd1"
  selection-stroke: "#245D4F"
  curve-handle: "#D8B46A"
typography:
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "18px"
  section:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "-0.01em"
rounded:
  swatch: "2px"
  field: "4px"
  compact: "5px"
  control: "6px"
  floating: "8px"
  dialog: "12px"
spacing:
  tight: "4px"
  compact: "8px"
  control-gap: "9px"
  regular: "12px"
  section: "15px"
  toolbar: "20px"
  panel: "23px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.green-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    width: "30px"
    height: "30px"
  tool-active:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.tool-active-ink}"
    rounded: "{rounded.compact}"
    height: "33px"
    padding: "0 10px"
  category-selected:
    backgroundColor: "{colors.row-selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    height: "37px"
    padding: "0 7px 0 10px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "7px 8px"
  paper:
    backgroundColor: "{colors.paper}"
  switch:
    backgroundColor: "{colors.green}"
    width: "29px"
    height: "17px"
    padding: "2px"
---

# Design System: PDF Overlayer

## Overview

**Creative North Star: "The Translucent Tracing Desk"**

Warm paper panels sit against a quiet gray-green work surface. The white document remains visually distinct, while precise green controls make the application feel calm, useful and ready for detailed work. Restrained Newsreader headings add a human signature; compact DM Sans controls carry the operational detail.

This system favours crisp rules, small controlled curves and restrained elevation. Most colour on the plan belongs to the user's editable overlays. Application states retain their own consistent language, independent of the colours chosen for rooms.

**Key Characteristics:**

- Warm, quiet surfaces with crisp control contrast.
- Compact, nearby controls with clearly expressed active states.
- White document paper with translucent content layered above it.
- Editorial serif accents supported by practical sans-serif typography.

This is a scan of `src/styles.css`, `src/App.tsx` and `src/PlanCanvas.tsx`. The frontmatter records implemented primitives; the sidecar carries depth, motion and component previews. `PRODUCT.md` owns product decisions. `.impeccable/direction.md` owns the editor's surface strategy. The current full-height editor composition and demo content are applications of this system, not mandatory templates for every future page. Default-state screenshot references are `.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`; this document does not constitute independent behaviour validation.

## Colors

The palette combines forest-green actions, warm off-white panels and a desaturated workspace; content colours remain user-controlled. Sidecar tonal ramps are synthesized previews, not additional implementation tokens.

### Primary

- **Tracing Green** (`green`): primary actions, focus outlines, the switch's on state, slider thumb and drawing-state dot.
- **Deep Tracing Green** (`green-dark`): primary hover and stronger fit-page emphasis.
- **Green Wash** (`green-light`): active tool background, paired with `tool-active-ink`.

### Neutral

- **Document White** (`paper`): PDF paper and reversed primary-action text.
- **Warm Panel** (`surface`): header, sidebar, toolbar and help surface.
- **Desk Gray-Green** (`canvas`): the space surrounding the document.
- **Forest Ink** (`ink`): default readable control and content text.
- **Quiet Ink** (`muted`): supporting labels, filenames, counts and explanatory text.
- **Soft Rule** (`line`): panel and section dividers.
- **Selected Wash** (`row-selected`, `row-selected-border`): persistent row selection; these are application states.
- **Field Paper** (`field`, `field-border`): editable room fields with a visible fine stroke.
- **Secondary Stroke / Hover** (`secondary-border`, `secondary-hover`): bounded secondary actions and their hover state.

### Named Rules

**The Content Colour Rule.** Room category colours and opacity are editable document content. Do not promote demo category colours into application state tokens or use the user's current category colour for focus, errors or tool selection.

**The State Contrast Rule.** Active controls use green text and a pale green surface; selection on the plan adds the fixed `selection-stroke`. White vertex handles and gold `curve-handle` controls distinguish corner editing from curve editing. Destructive actions use `danger` and explicit text or icons.

### Interface themes

The header theme control offers **System**, **Light** and **Dark**. System is the default and follows live changes to `prefers-color-scheme`. An explicit choice is stored under `pdf-overlayer.theme` when browser storage is available and synchronised across tabs. The initial HTML resolves the theme before the app loads; `src/theme.ts` maintains it after mounting.

The frontmatter describes the light palette. `:root[data-theme='dark']` in `src/styles.css` remaps the interface's semantic tokens to a forest-tinted dark palette: surface `#202923`, canvas `#141c18`, ink `#e5ece6`, muted ink `#b0beb4`, action fill `#8bc8ac` and action text `#142d22`. Use `--on-accent` for primary-action text instead of coupling it to document white. Fields, selection, notices, errors, keyboard hints, scrollbars and temporary surfaces have explicit theme roles. The sidecar records both palettes under `extensions.themes`.

**The White Document Rule.** `--paper` stays `#ffffff` in both themes. The PDF canvas, SVG room fills, editing handles, on-page legend and export colours retain their document values. Do not invert, tint or filter the PDF to implement dark mode. `.paper` retains the light native colour scheme. Only the interface and space around the plan change appearance.

## Typography

**Display Font:** Newsreader, with Georgia and serif fallbacks.

**Body Font:** DM Sans, with sans-serif fallback. Keyboard hints inherit this family; no distinct monospace face is introduced.

**Character:** Newsreader is a restrained editorial accent, not a large decorative layer. DM Sans carries the dense controls and information, with tabular numerals for counts, zoom, opacity and dimensions.

### Hierarchy

- **Headline:** the frontmatter headline role describes the sidebar heading. It becomes smaller on intermediate widths and slightly larger on wide screens. Help, empty and drop surfaces also use Newsreader at their observed contextual sizes.
- **Title:** the brand uses the title role; its emphasized word is semibold (600). The mobile brand scales down progressively.
- **Section:** compact semibold headings separate tool and property groups.
- **Body:** explanatory sidebar prose uses the body role, with a short measure for legend guidance (28ch). Help prose uses a slightly larger treatment (12px) and generous line height (1.65–1.7).
- **Label:** action labels use the label role. Tools and room rows use a smaller operational size (11px); metadata and keyboard hints step down further (9–10px).

**The Quiet Signature Rule.** Preserve the contrast between occasional Newsreader headings and DM Sans controls. Do not transfer the serif treatment to routine buttons, fields, numeric feedback or lists.

## Layout

The reusable spatial grammar is a bounded work surface, nearby compact controls and sections separated by fine rules. The current editor uses the full viewport height (`100dvh`), hides outer overflow and gives the document its own scroll area. The PDF is centred on its desk at fit scale; intentional zoom expands the scrollable stage rather than shrinking editing targets. Fit calculations leave document breathing room (84px across each stage dimension).

The editor's default sidebar is fixed-width (282px) and scrolls independently. Its header, drawing toolbar, document controls and status rail are compact horizontal bands (79px, 55px, 45px and 37px). These are current editor measurements, not universal navigation requirements.

- **Wide screens (from 1600px):** sidebar expands to 300px; header to 83px and drawing toolbar to 59px; selected text and row sizes increase slightly.
- **Intermediate screens (through 1100px):** sidebar narrows to 250px, tool text labels hide, and secondary example copy drops away.
- **Small screens (through 780px):** the sidebar becomes a fixed 282px drawer below a 68px header, with a scrim and explicit open/close controls. Drawing and page controls remain in the workspace. Toolbar icons retain accessible labels; physical page dimensions hide.
- **Narrow screens (through 430px):** Open PDF becomes icon-only, action gaps tighten and tool widths reduce. The implemented minimum body width is 360px.

Use the compact spacing vocabulary for related controls, then larger section and panel insets for grouping. Do not infer an abstract spacing multiplier: the implementation uses contextual values rather than one uniform modular scale.

## Elevation & Depth

Tonal layering and fine borders define ordinary panels. Shadows establish a physical relationship for white paper and lift temporary controls or dialogs above it. Avoid giving every sidebar section the appearance of a floating card.

### Shadow Vocabulary

- **Paper:** `0 4px 24px #293a3217, 0 1px 4px #293a3210` separates the document from the desk.
- **Drawing bar:** `0 4px 22px #293a3226` lifts the temporary shape controls.
- **Message:** `0 5px 26px #293a3226` distinguishes transient feedback.
- **Help dialog:** `0 16px 80px #182f3533` places help over a translucent backdrop.
- **Slider thumb:** `0 1px 3px #203d3026` is a small control affordance.

**The Paper Depth Rule.** Reserve substantial shadow for document paper and temporary raised surfaces. Persistent application panels remain quiet, bounded surfaces.

## Shapes

Small rounded rectangles give controls a precise but approachable form. Standard buttons use the control radius; fields and swatches are tighter, list rows and tools use the compact radius, and temporary bars/messages use the floating radius. Help and file-drop surfaces use the dialog radius. The PDF and its on-page legend retain square corners. Only switches, dots and editing handles use circular or pill forms.

Borders are thin and functional: panel divisions, input boundaries, selected categories and legend colour swatches. Dashed lines communicate a draft, a curve guide or a file-drop target; they are not decorative framing.

## Components

### Buttons

Compact, legible actions with restrained state changes.

- **Primary:** green fill, white text, control radius and label typography. Export adds a little inline padding in the editor.
- **Secondary:** warm-panel fill, fine secondary stroke and ink text; hover changes the surface tone.
- **Icon:** compact square with quiet text colour; hover adds a pale background and stronger ink. Use accessible names and titles, especially when visible labels disappear.
- **Focus / Disabled:** interactive elements use a green outline (2px) with an offset (3px). Disabled buttons use opacity (0.4) and a not-allowed cursor.
- **Motion:** background and colour changes use the fast duration (150ms). There is no additional default pressed transform in the implementation.

### Tool and page controls

The drawing toolbar is a compact mode selector, not a site navigation bar. Active tools use Green Wash and stronger green text with medium weight. Page and zoom controls use small tabular numerals, fine select borders and compact icons. Fit-page selection uses a pale desk-green surface. Keep pressed state and accessible labels explicit when tool text is hidden.

### Category and room rows

Rows connect an item in the list to content on the plan. Category rows combine an editable square colour swatch, label, tabular count and edit affordance; selection has a pale wash and fine border. Room rows pair a smaller swatch with an ellipsized name and visibility control; hidden room labels fade. Counts are small rounded neutral badges, not navigation chips. The swatches are content previews, not status indicators.

### Inputs / Fields

Room name and category fields use warm field paper, a fine border, tight radius and compact padding. Category label editing is inline with a green underline. The colour input is visually represented by its swatch, and receives a visible focus-within outline. Opacity uses a thin neutral rail, small green thumb and visible percentage. Preserve labels and supporting values when changing density.

### Cards / Containers

Persistent sections use warm surfaces and thin dividers rather than individual card shadows. White document paper is the signature raised container. The help dialog is a rounded warm-panel container with a translucent backdrop, bounded viewport size and a native dialog presentation.

### Legend switch

A compact pill changes from muted green-gray to Tracing Green when on. Its white circular thumb moves horizontally. Checked state is expressed through `aria-checked` as well as colour and position.

### Tracing surface

User category fill is translucent and uses multiply blending on the plan. Completed selections use the fixed green stroke. A draft uses a dashed outline and lighter fill, with the first vertex enlarged and visibly distinct as the closure target. Selected corners use white circles with green strokes; quadratic-curve controls use gold circles and dashed guides. Handle and stroke dimensions compensate for zoom so editing affordances remain visually stable.

The on-page legend follows the user's reference plan: a borderless white panel with a bold dark title, a smaller gray subtitle, generous separation between category groups, and rectangular colour swatches beside semibold category labels. Numbered room names sit below each category; small white circles with category-coloured outlines match draggable markers on the plan. Optional gray notes and smaller footer text follow the groups. DM Sans regular and semibold are embedded for export. The title defaults to the source filename; all legend text is editable per page.

`src/legend.ts` supplies one measured layout to both the SVG preview and PDF export. Its 306-point panel scales proportionately for smaller pages, starts at the lower right and stays movable within the original page. Room numbering spans the document, survives category and visibility changes, and supports older saved projects. The legend is document content: preserve its white background and dark text in both interface themes, and use the user's category colours and transparency for its swatches.

### Feedback and temporary surfaces

Notices and errors are compact raised messages with explicit text, an icon or dismiss control, and distinct light surfaces. Busy states overlay the canvas with a translucent desk tone and a labelled spinner. The file-drop target uses a dashed green boundary. Motion stays brief and functional: the drawer uses 180ms, the switch thumb 160ms, and loading rotation 1.1s linear. The reduced-motion media query effectively removes transitions and repeated animation.

## Do's and Don'ts

### Do:

- **Do** keep warm application panels, gray-green desk and white document paper visually distinct.
- **Do** preserve fixed green focus and selection cues independently of editable room colours.
- **Do** use Newsreader sparingly and DM Sans for controls and numerical feedback.
- **Do** pair compact controls with accessible names, visible focus and explicit active states.
- **Do** use fine rules for persistent grouping and reserve substantial elevation for paper and temporary surfaces.
- **Do** keep the current editor's composition and demo messaging in surface strategy rather than treating them as global page requirements.

### Don't:

- **Don't** turn category swatches or example overlay colours into application semantic states.
- **Don't** use a decorative shadow on every sidebar section or soften the actual document into a rounded card.
- **Don't** replace explicit drawing, selection or error feedback with colour alone.
- **Don't** introduce new motion or large display typography by extrapolating from the quiet serif accent.

# UI/UX Design Specification & Design System

**Document Version:** 1.0.0  
**Target Platform:** Web Application (`apps/web`) & Blender Add-on UI  
**Visual Aesthetic:** Professional Dark Creative Studio (Blender & Linear Inspired)  
**Lead Designer:** UX/UI Architect  

---

## 1. Design Principles

1. **Tool-Grade Focus:** Dark, restrained, distraction-free surfaces that prioritize the visual content—highlighting the reference image and the 3D WebGL viewport.
2. **Honest System State:** Never display fabricated progress bars or fake success animations. The UI faithfully reflects the backend queue and provider polling states (`queued`, `processing`, `completed`, `failed`).
3. **Fixture Transparency:** In development and test modes, generated models derived from local test fixtures are clearly tagged with an amber `[MOCK FIXTURE]` badge to avoid confusion with live AI outputs.
4. **Fluid Responsiveness:** Seamless transitions between side-by-side workspace layouts on desktop to stacked, scrollable views on tablet and mobile viewports.

---

## 2. Color System & Design Tokens

```css
:root {
  /* Surfaces */
  --bg-app: #101216;          /* Deep slate background */
  --bg-panel: #171B22;        /* Sidebar and card panels */
  --bg-surface: #202630;      /* Elevated surfaces, dropdowns, inputs */
  --bg-surface-hover: #2B3340;/* Interactive hover state */
  --bg-canvas: #0B0D10;       /* WebGL 3D Viewport background */

  /* Borders & Dividers */
  --border-subtle: #242B38;
  --border-default: #323C4D;
  --border-focus: #22D3EE;

  /* Typography */
  --text-primary: #F3F4F6;    /* High contrast primary text */
  --text-secondary: #9CA3AF;  /* Muted metadata and labels */
  --text-tertiary: #6B7280;   /* Placeholders and hints */
  --text-inverse: #101216;    /* Contrast text for bright buttons */

  /* Accents & Brand */
  --accent-cyan: #22D3EE;     /* Primary brand, active states, focus */
  --accent-cyan-hover: #06B6D4;
  --accent-glow: rgba(34, 211, 238, 0.15);

  /* Status Colors */
  --status-success: #34D399;  /* Completed jobs, active connection */
  --status-warning: #FBBF24;  /* Queued state, mock fixture badge */
  --status-error: #F87171;    /* Failed jobs, validation errors */
  --status-info: #60A5FA;     /* Informational badges */
}
```

---

## 3. Typography & Spacing

- **Primary Typeface:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- **Monospace Typeface:** `JetBrains Mono`, `Roboto Mono`, monospace (used for job IDs, polycounts, coordinates, API tokens).
- **Scale:**
  - `Display / H1`: 28px (Bold, line-height 1.2)
  - `H2 / Section Title`: 20px (Semi-bold, line-height 1.3)
  - `H3 / Card Title`: 16px (Semi-bold, line-height 1.4)
  - `Body`: 14px (Regular, line-height 1.5)
  - `Caption / Small`: 12px (Medium, line-height 1.4)
  - `Micro / Badge`: 10px (Semi-bold, uppercase, letter-spacing +0.5px)
- **Spacing Grid:** 4px baseline, 8px layout rhythm (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).

---

## 4. Layout & Responsive Breakpoints

```
┌────────────────────────────────────────────────────────────────────────┐
│ App Header (Logo, Mode Toggle, User Profile, API Token)               │
├──────────────┬────────────────────────────┬────────────────────────────┤
│ Left Panel   │ Center Workspace           │ Right Inspector            │
│ (280px)      │ (Flexible 1fr)             │ (320px)                    │
│              │                            │                            │
│ • Upload     │ • Active 3D Viewport       │ • Mesh Details             │
│ • Parameters │   (Three.js WebGL Canvas)  │ • Polycount / Geometry     │
│ • Generate   │   or                       │ • Texture Maps             │
│ • History    │ • Image Dropzone Preview   │ • Blender Import Steps     │
│              │                            │ • Download Options         │
└──────────────┴────────────────────────────┴────────────────────────────┘
```

- **Desktop (>= 1280px):** 3-column studio layout (Left: Controls & Queue, Center: 3D Canvas, Right: Inspector & Actions).
- **Laptop (1024px – 1279px):** 2-column layout (Left: Controls & Inspector tabs, Right: 3D Canvas).
- **Tablet / Mobile (< 1024px):** Single-column stacked layout with full-width tabs (`Studio`, `Viewer`, `Library`).

---

## 5. Screen Specifications & User Workflows

### 5.1 Image Upload & Preparation Panel
- **Drag & Drop Zone:** Border dashed `--border-default`, transitions to `--accent-cyan` with subtle glow on drag-over.
- **File Validation Card:** Displays thumbnail preview, file name, dimensions (e.g. `1024 x 1024 px`), and file size (`2.4 MB`).
- **Generation Parameters Form:**
  - *Model Series:* Dropdown (`Flagship v3.1` or `Low-Poly P1`).
  - *Texture & PBR:* Switch toggles for diffuse texture and PBR material synthesis.
  - *Face Target:* Number input or slider (e.g. `20,000` to `100,000` faces).
- **Submit Button:** High-contrast button (`--accent-cyan` background with dark text) reading: `"Generate 3D Asset"`.

### 5.2 Live Generation Progress State
- When a job is submitted, the center workspace displays a live generation card:
  - **State Pill:** 
    - `queued`: Amber pulse indicator with message: `"Waiting in GPU queue..."`.
    - `processing`: Cyan spinner with message: `"Inferring geometry and synthesizing textures..."` and live progress bar (`0%` to `100%`).
  - **Cancellation Button:** Option to cancel queued jobs before GPU execution begins.

### 5.3 Interactive 3D Model Viewport (Three.js Canvas)
- **WebGL Canvas (`--bg-canvas`):** Full hardware-accelerated 3D rendering.
- **Viewport Toolbar (Overlay top-center):**
  - Orbit / Pan / Zoom mode indicator.
  - Wireframe overlay toggle (`W` hotkey).
  - Environment lighting presets (Studio Neutral, Warm Rim, Outdoor Sun).
  - Reset Camera View button (`Space` hotkey).
  - Bounding Box / Grid floor toggle.
- **Performance:** Rendered using `PerspectiveCamera`, `DirectionalLight`, `AmbientLight`, and `OrbitControls` with smooth damping enabled.

### 5.4 Inspector & Export Panel (Right Sidebar)
- **Model Metadata Card:**
  - Mesh Status: `"Completed"` (Green badge) or `"Mock Fixture"` (Amber badge).
  - Polygon Count: e.g. `34,812 Triangles`.
  - Vertex Count: e.g. `17,604 Vertices`.
  - File Format: `glTF 2.0 Binary (.glb)`.
  - File Size: e.g. `4.8 MB`.
- **Primary Action Buttons:**
  - `"Download .GLB"`: Generates temporary signed download URL.
  - `"Import to Blender"`: Quick modal explaining Blender Add-on instructions.

### 5.5 Asset Library / Gallery Screen
- Grid of asset cards with 1:1 square rendered previews.
- Badges displaying status (`Ready`, `Processing`, `Failed`).
- Search by date or asset name, filter by status.
- Batch selection and bulk delete functionality.

### 5.6 Blender Add-on Integration Screen
- Dedicated tab providing:
  1. **Download Add-on `.zip`:** Single click download for `blender_ai_addon.zip`.
  2. **Personal API Token Card:** Masked token with one-click copy button and regeneration option.
  3. **Visual Onboarding Guide:** 3-step illustrated instructions:
     - Open Blender Preferences -> Add-ons -> Install `.zip`.
     - Paste API Token into Blender AI preferences.
     - Press `N` in 3D Viewport to open the sidebar and click `"Import into Scene"`.

---

## 6. Accessibility & Keyboard Navigation

- **Color Contrast:** All text tokens meet WCAG 2.1 AA standards (minimum 4.5:1 contrast against surface backgrounds).
- **Keyboard Shortcuts:**
  - `Space`: Reset 3D camera to default framing.
  - `W`: Toggle wireframe view in 3D viewport.
  - `G`: Toggle ground grid plane.
  - `Esc`: Close modals and inspection drawers.
- **Focus Indicators:** Visible 2px outline in `--accent-cyan` on all interactive buttons, inputs, and canvas containers.

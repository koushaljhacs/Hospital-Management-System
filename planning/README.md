# Planning Folder Documentation

## Overview

The `/planning/` folder contains all architectural planning documents, design files, and the interactive Mermaid diagram for the Hospital Management System.

## Folder Structure

```
planning/
├── README.md                          # This documentation file
├── architecture.html                  # Interactive Mermaid architecture diagram
├── index.html                         # Planning & concept documentation
├── plan.txt                           # Project planning notes
├── build-minify.ps1                   # Build script for minification
│
├── assets/                            # External resources
│   ├── css/
│   │   └── architecture.css           # Architecture diagram styles
│   ├── js/
│   │   └── architecture.js            # Architecture diagram scripts
│   └── images/
│       ├── background.png
│       ├── health monitor.png
│       ├── monitoring.png
│       └── reception.png
│
└── dist/                              # Production builds (minified)
    ├── index.html
    ├── css/
    │   ├── style.min.css
    │   └── animations.min.css
    └── js/
        └── script.min.js
```

## Key Files

### architecture.html
- **Purpose:** Interactive Mermaid diagram showing system architecture
- **Size:** 260 lines of clean, modular HTML
- **External Dependencies:**
  - `assets/css/architecture.css` - All styling
  - `assets/js/architecture.js` - All scripting
- **Features:**
  - Zoom controls (bottom-right floating buttons)
  - 10 major system divisions
  - 80+ interconnected components
  - 60+ data flow connections

### assets/css/architecture.css
- **Purpose:** Separated CSS for architecture diagram
- **Size:** 260+ lines of modular CSS
- **Features:**
  - Background animations (bgCycle, gradientShift)
  - Letter-wave animation for title
  - Server room visualization
  - Zoom controls styling
  - Responsive design utilities
- **Benefit:** No CSS conflicts with index.html

### assets/js/architecture.js
- **Purpose:** Separated JavaScript for architecture diagram
- **Size:** 70+ lines of modular JavaScript
- **Features:**
  - Animated title text effect
  - Zoom control functions
  - Mermaid diagram initialization
  - Event listeners and UI updates
- **Benefit:** No JavaScript conflicts with index.html

### index.html
- **Purpose:** Main planning documentation page
- **Contains:** Concept explanations, system design details, team info
- **Status:** Keep in source format (not minified for easy reading)

### plan.txt
- **Purpose:** Text-based notes on system architecture
- **Contains:** List of components, connections, workflow descriptions
- **Status:** Reference document for development

## Build & Deployment

### Development Mode
```bash
cd planning
# Open architecture.html directly in browser
# Use source files for development
```

### Production Mode
```bash
# Run build-minify.ps1 to create dist/ folder
.\build-minify.ps1

# Minified files created:
# - dist/css/style.min.css (30% reduction)
# - dist/css/animations.min.css (44% reduction)
# - dist/js/script.min.js (35% reduction)
```

## Important Notes

### ✅ Modular Organization
- CSS and JS are **separated from HTML** (no inline styles/scripts)
- Each file has a **single responsibility**
- Changes to one component don't affect others
- Clean separation between planning files and root files

### ✅ No Root Contamination
- All planning files are **within /planning/ folder**
- Root folder contains only: `LICENSE.md`, `README.md`, `.gitignore`
- Hospital Management System files are separate from planning files

### ✅ Git Ready
- Structure is clean and organized
- No unnecessary files or duplicates
- Easy to navigate and maintain
- Ready for GitHub deployment

## Accessing the Diagram

### Online (GitHub Pages)
```
https://koushaljhacs.github.io/Hospital-Management-System/planning/architecture.html
```

### Locally
```bash
1. Navigate to planning/ folder
2. Open architecture.html in your web browser
3. Use zoom controls in bottom-right corner
```

## Features Overview

### Interactive Elements
- **Zoom Controls:** Adjust diagram size (10% - 300%)
- **Animated Title:** Letter-wave color effect
- **Live Diagram:** Mermaid renders flowchart in real-time
- **Responsive Design:** Adapts to different screen sizes

### System Components Shown
- **10 Major Divisions:** Clinical, Diagnostic, Logistics, In-Patient, Pharmacy, Revenue, HR, Security, Infrastructure, Communication
- **Backend Services:** *Backend implementation is out of scope for the `/planning/` folder and is not included here.*
- **User Roles:** Doctors, Nurses, Pharmacists, Lab Techs, Administrators, etc.
- **Data Flows:** Connections showing how services interact

### Performance
- **Lightweight:** No heavy frameworks or dependencies
- **Fast Load:** Uses CDN for external libraries
- **Smooth Animations:** GPU-accelerated CSS transforms
- **60fps Rendering:** Optimized for modern browsers

## Maintenance

### To Update Architecture Diagram
1. Edit `architecture.html` - Keep HTML clean and semantic
2. Update styles in `assets/css/architecture.css` if needed
3. Update scripts in `assets/js/architecture.js` if functionality changes
4. Test in browser before committing

### To Update Planning Notes
1. Update `plan.txt` for quick reference
2. Update `index.html` for detailed documentation
3. Keep changes aligned with actual implementation

## Next Steps

1. **Review the Architecture:** Open `architecture.html` and explore the system design
2. **Read Planning Notes:** Check `plan.txt` for detailed component descriptions
3. **Study the Implementation:** Review `index.html` for full documentation
4. **Deploy to Production:** Run `build-minify.ps1` to create production files

---

**Last Updated:** February 8, 2026
**Architect:** KOUSHAL JHA
**Status:** Production Ready ✅

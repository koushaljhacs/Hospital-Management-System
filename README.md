# Hospital Management System (HMS)

> **A Comprehensive Academic Project:** Enterprise-Grade Hospital Operating System with Push-Intelligence Architecture

[![License](https://img.shields.io/badge/License-HMS%20Academic%20-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Desktop%20%7C%20Mobile-9966ff.svg)]()

---

## PROJECT OVERVIEW

The **Hospital Management System (HMS)** is a next-generation hospital operating system designed to transition healthcare facilities from **reactive information-pull** architectures to **proactive push-intelligence ecosystems**. Built as an academic project with production-grade engineering principles, HMS demonstrates how distributed systems, event-driven architecture, and real-time data orchestration can revolutionize hospital operations.

### LIVE DEMO
**[View Live Website →](https://koushaljhacs.github.io/Hospital-Management-System/planning/dist/index.html)**

> **Note:** Explore the interactive animated architecture blueprint showcasing the complete hospital ecosystem design.

---

## KEY FEATURES

### Push-Intelligence Paradigm
- Real-time event-driven alerts instead of manual dashboard searching
- WebSocket-based instant notifications to relevant staff
- Critical value alerts for diagnostic results
- Automatic task dispatch and resource optimization

### Modular Architecture
- **Clinical Division** - Smart CPOE with atomic order integrity
- **Diagnostic Division** - Result streaming with push alerts
- **Logistics Division** - Intelligent task dispatch engine
- **In-Patient Division** - Bed state machine with mandatory workflows
- **Pharmacy & Store** - FIFO inventory with automated procurement
- **Revenue Division** - Synchronized ledger preventing financial leakage
- **HR & Governance** - Executive dashboards with institutional analytics

### Security & Compliance
- HIPAA/HL7/FHIR privacy standards
- Break-Glass protocol with dual-signature access elevation
- JWT-based RBAC (Role-Based Access Control)
- 256-bit AES encrypted tunnels
- Automated audit trails and compliance reporting

### High-Performance Infrastructure
- Hybrid Backend: Java (ACID) + Node.js (WebSocket)
- PostgreSQL 16+ with ACID-compliant transactions
- HikariCP connection pooling with WAL recovery
- 16GB dedicated edge hardware deployment
- Sub-millisecond local data retrieval

### Modern User Experience
- Mobile-first responsive design
- Smooth 60fps animations with GPU acceleration
- Glass-morphism UI with vibrant gradients
- Typewriter text effects and scroll-triggered reveals
- One-click rapid order entry with JSON presets

---

## TECHNOLOGY STACK

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3, Bootstrap 5.3, Vanilla JavaScript (ES6+) |
| **Backend (Sync)** | Java, Spring Boot, Hibernate |
| **Backend (Async)** | Node.js, Express.js, Socket.io |
| **Database** | PostgreSQL 16+, JSONB, WAL Recovery |
| **Real-Time** | WebSocket, Server-Sent Events |
| **DevOps** | Git, Maven, PM2, Nginx |
| **Security** | JWT, RBAC, SSL/TLS, AES-256 |
| **Infrastructure** | Local-Edge (16GB Host), Ngrok Tunneling |

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────┐
│           PUSH-INTELLIGENCE ECOSYSTEM               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │
│  │   Clinical   │→ │  Diagnostic  │→ │ Logistics│   │
│  │   Division   │  │   Division   │  │ Division │   │
│  └──────────────┘  └──────────────┘  └──────────┘   │
│         ↓                  ↓                ↓       │
│  ┌──────────────────────────────────────────────┐   │
│  │     Real-Time Event Bus (WebSocket)          │   │
│  └──────────────────────────────────────────────┘   │
│         ↓                  ↓                ↓       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │
│  │ In-Patient   │  │  Pharmacy &  │  │ Revenue  │   │
│  │  Division    │  │    Store     │  │ Division │   │
│  └──────────────┘  └──────────────┘  └──────────┘   │
│                                                     │
│     PostgreSQL 16+ (ACID Transactions + WAL)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## INTERACTIVE ARCHITECTURE BLUEPRINT

This project includes a comprehensive **Interactive Mermaid Diagram** showcasing the complete system architecture:

### 🗂️ Planning Resources

**Location:** `/planning/` folder

- **`architecture.html`** - Complete system architecture diagram with Mermaid flowchart
- **`architecture/css/architecture.css`** - Modular CSS styles for diagram
- **`architecture/js/architecture.js`** - JavaScript for zoom controls and interactions
- **`index.html`** - Main planning and concept documentation
- **`plan.txt`** - Project planning notes and requirements

### 📊 Architecture Diagram Features

The interactive diagram includes:

1. **10 Major System Divisions:**
   - 🏥 Clinical Division - Smart CPOE, Order Sets, Allergy Checks
   - 📊 Diagnostic Division - Lab Streaming, RIS/PACS, Critical Values
   - 📍 Logistics Division - Zone-Based Dispatch, Auto-Assignment
   - 🛏️ In-Patient Division - Bed State Machine, Admission Workflow
   - 💊 Pharmacy Division - FIFO Logic, Inventory Management
   - 💰 Revenue Division - Point-of-Care Billing, Atomic Ledger
   - 👥 HR & Governance - Shift Management, Analytics Dashboard
   - 🔒 Security & Access - RBAC, Break-Glass, Audit Logging
   - ⚙️ Infrastructure Layer - Nginx, Ngrok, SSL, Firewall, PM2
   - 📡 Communication Layer - WebSocket, FCM, SMTP, Patient Portal

2. **Backend Infrastructure:**
   - ☕ **Java Engine** - ACID transactions, synchronized ledger
   - 🟢 **Node.js Engine** - Event streaming, WebSocket orchestration
   - 🗄️ **PostgreSQL 16+** - JSONB support, WAL recovery, materialized views

3. **Data Flow Visualization:**
   - Animated connecting lines showing data relationships
   - Color-coded connections for different interaction types
   - Edge labels describing workflow and data direction
   - 60+ system components fully interconnected

### 🎯 How to View

1. **Online (GitHub Pages):**
   ```
   https://koushaljhacs.github.io/Hospital-Management-System/planning/dist/architecture/architecture.html
   ```

2. **Locally:**
   ```bash
   cd planning
   # Option 1: View source files (development)
   open architecture/architecture.html
   
   # Option 2: View minified production files
   open dist/architecture/architecture.html
   ```

3. **Zoom Controls:**
   - Use the floating zoom buttons (bottom-right corner)
   - `+` button: Zoom in
   - `-` button: Zoom out
   - `Reset` button: Return to default view (40%)
   - Percentage indicator: Shows current zoom level

---

## ACADEMIC PURPOSE

This project demonstrates:

- **System Design Excellence** - How to architect complex, distributed healthcare systems
- **Real-Time Architecture** - Event-driven patterns with WebSocket orchestration  
- **Database Integrity** - ACID compliance, transaction management, WAL recovery
- **Security Best Practices** - HIPAA compliance, authentication, authorization
- **Frontend Performance** - 60fps animations, GPU acceleration, responsive design
- **DevOps & Deployment** - CI/CD pipelines, automated builds, production readiness

**Intended Audience:**
- Computer Science Students - Study advanced system architecture
- Educators - Teach enterprise software engineering principles
- Companies - Evaluate technical capabilities and architectural thinking
- Recruiters - Assess engineering depth and full-stack proficiency

---

## PROJECT STRUCTURE

```
Hospital-Management-System/
├── LICENSE                              # Custom Academic License
├── README.md                            # This file
├── .gitignore                           # Git ignore rules
│
└── planning/                            # PLANNING & DEVELOPMENT
    ├── .gitignore                       # Planning-specific git rules
    ├── LICENSE.md                       # Academic license for planning
    ├── README.md                        # Planning documentation
    ├── index.html                       # Main planning document (source)
    ├── style.css                        # Source styles (modular)
    ├── animations.css                   # Source animations
    ├── script.js                        # Source JavaScript
    ├── plan.txt                         # Project planning notes
    ├── build-minify.ps1                 # CSS/JS minification script
    │
    ├── assets/                          # Images
    │   ├── background.png
    │   ├── health\ monitor.png
    │   ├── monitoring.png
    │   └── reception.png
    │
    ├── architecture/                    # ARCHITECTURE DIAGRAM (Source)
    │   ├── architecture.html            # Interactive Mermaid diagram
    │   ├── css/
    │   │   └── architecture.css         # Diagram styles (343 lines)
    │   └── js/
    │       └── architecture.js          # Diagram interactions (70+ lines)
    │
    ├── security/                        # SECURITY MODULES (Silent Protection)
    │   ├── README.md                    # Security documentation
    │   ├── security.config.js           # Master initialization
    │   ├── device-checker.js            # Mobile detection & blocking
    │   ├── anti-debug.js                # DevTools disabling (F12, Ctrl+Shift+I)
    │   ├── copy-protection.js           # Copy/paste/cut prevention
    │   ├── screenshot-blocker.js        # Print Screen blocking
    │   └── context-menu-blocker.js      # Right-click menu disabling
    │
    └── dist/                            # PRODUCTION (Minified Assets)
        ├── index.html                   # Production main document
        ├── css/
        │   ├── style.min.css            # (30% reduction from source)
        │   └── animations.min.css       # (44% reduction from source)
        ├── js/
        │   └── script.min.js            # (35% reduction from source)
        │
        └── architecture/                # ARCHITECTURE DIAGRAM (Production)
            ├── architecture.html        # Production version (minified paths)
            ├── css/
            │   └── architecture.min.css # Minified CSS (single line)
            └── js/
                └── architecture.min.js  # Minified JS (single line)
```

---

## QUICK START

### 1. **View Live Website**
Visit: https://koushaljhacs.github.io/Hospital-Management-System/planning/dist/

### 2. **Clone Repository**
```bash
git clone https://github.com/koushaljhacs/Hospital-Management-System.git
cd Hospital-Management-System
```

### 3. **Development (Local)**
```bash
cd planning
# Open index.html in your browser to see the complete design
# Source files: style.css, animations.css, script.js
```

### 4. **Generate Minified Files** (Production)
```bash
cd planning
# Run PowerShell script to minify CSS and JavaScript
.\build-minify.ps1

# Output: dist/ folder with minified assets
# CSS: 30-44% smaller
# JS: 35% smaller
```

### 5. **Deploy to Production**
The `dist/` folder contains optimized production files ready for deployment.

---

## FEATURES SHOWCASE

### Animated Hero Section
- Vibrant multi-layer gradient backgrounds
- 12-second color-shifting animation cycle
- Smooth 60fps performance with GPU acceleration
- Responsive design for all devices

### Typewriter Effect
- Infinite looping text animation
- Gradient text transition effects
- Character-by-character reveal timing
- Professional presentation layer

### Scroll Triggered Animations
- Role tag reveals with stagger effect
- Content fade-ins as you scroll
- Glowing border animations
- Smooth scroll performance with requestAnimationFrame

### Premium UI Design
- Glass-morphism effect cards
- Vibrant blue gradient ecosystem
- Professional typography hierarchy
- Perfect spacing and alignment

---

## 📚 DETAILED DOCUMENTATION

For in-depth information about:
- **System Architecture** - See `planning/dist/index.html` Section 3
- **Functional Architecture** - See `planning/dist/index.html` Section 4
- **Technology Stack** - See `planning/dist/index.html` Section 5
- **Future Roadmap** - See `planning/dist/index.html` Section 7

---

## PROJECT TEAM

| Role | Name | Responsibility |
|------|------|-----------------|
| **Lead Architect** | **KOUSHAL JHA** | Overall system design, project planning, full-stack |
| **Frontend & DB Dev** | HITANSHU DHAKREY | PostgreSQL schema, Java logic, DBA |
| **Node.js Dev** | ABHAY BANSAL | Asynchronous event layer, WebSocket engine |
| **Frontend Dev** | SUNDRAM | UI components, responsive design |
| **Frontend Dev** | SUYASH | Stateful UI interactions, compatibility |

---

## LICENSE

This project is licensed under the **HMS Academic License v1.0** - See [LICENSE](LICENSE) file for details.

**Key Points:**
- Educational and learning purposes
- Academic and institutional analysis
- Company technical evaluation
- NO commercial use without written permission
- NO production healthcare deployment
- Unauthorized code = repository stripping

---

## IMPORTANT LINKS

- 🌐 **Live Demo:** [Visit Website](https://koushaljhacs.github.io/Hospital-Management-System/planning/dist/index.html)
- 📖 **GitHub Repository:** https://github.com/koushaljhacs/Hospital-Management-System
- 👤 **Architect LinkedIn:** https://www.linkedin.com/in/koushal-jha-cs27/
- 🐙 **Architect GitHub:** https://github.com/koushaljhacs

---

## DISCLAIMER

**This is an EDUCATIONAL PROJECT ONLY.** 

- NOT suitable for production healthcare use
- NOT HIPAA certified for real patient data
- Used for learning and architectural understanding
- Demonstrates best practices but may not include all compliance requirements
- Any production use requires proper healthcare system certification

---

## CONTRIBUTING

Contributions welcome! Please:

1. **Request Permission** - Email or message KOUSHAL JHA
2. **Follow Standards** - Adhere to project coding guidelines
3. **Write Tests** - Include testing for new features
4. **Document Changes** - Update relevant documentation
5. **Submit PR** - Create pull request for review

All contributors will be acknowledged in the project.

---

## CONTACT & INQUIRIES

For:
- 📞 **General Questions** - Open a GitHub issue
- 💼 **Corporate Partnerships** - LinkedIn message
- 🎓 **Academic Inquiries** - GitHub discussions
- 🔐 **Security Concerns** - Direct message (no public issues)

---

## SHOW YOUR SUPPORT

If you find this project useful for learning, please give it a star!

Your support helps others discover this comprehensive healthcare system architecture example.

---

<div align="center">

### Hospital Management System (HMS)
### *Enterprise-Grade Architecture for Academic Excellence*

**© 2026 KOUSHAL JHA | All Rights Reserved**

</div>
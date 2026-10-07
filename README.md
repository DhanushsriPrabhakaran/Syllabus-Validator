# TCE Syllabus Validator (MERN)

> A production-grade MERN web application built for **Thiagarajar College of Engineering (TCE)** faculty to validate course syllabus PDFs against official college curriculum and course-design guidelines.

---

## 📌 Features

- **Google Workspace Authentication:** Strict gatekeeping allowing only verified staff accounts from `@tce.edu`. Rejects subdomains (e.g. `@student.tce.edu`) and personal Google accounts with HTTP 403.
- **Side-by-Side Review & Bounding Box Overlays:** Coordinate-level PDF viewer with interactive highlight overlays synchronized bi-directionally with finding cards.
- **Deterministic Validation Rule Engine:** 100% deterministic code implementing all TCE guidelines across:
  - **Theory Courses** (`THEORY-*` rules)
  - **Practical / Lab Courses** (`LAB-*` rules)
  - **Theory cum Practical Courses** (`TCP-*` rules)
  - **Legacy Regulation 2022 Conversion** (`LEGACY-*` rules)
- **Multi-Course Booklet Segmentation:** Automatically splits multi-course curriculum booklets (e.g., `22CA120 Data Structures and Applications`) into isolated course validation workflows.
- **Dual Validation Profiles:**
  - `REG2026_STRICT`: Enforces 2026 standards, flagging missing modern sections as errors.
  - `LEGACY_COMPAT`: Converts legacy format gaps into warnings to guide migration to Regulation 2026.
- **Data-Driven Rules Configuration:** Thresholds, action verbs, Bloom-to-TPS mappings, and programme codes are stored in MongoDB (`RulesConfig`) and editable by Admins.
- **Export & Versioning:** Re-validate after edits, track progress across versions (`v1`, `v2`), and export audit reports as PDF or JSON.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, React Router v6, Tailwind CSS, `@react-oauth/google`, `react-pdf` (PDF.js), TanStack Query.
- **Backend:** Node.js 20+, Express, Mongoose, `google-auth-library`, `jsonwebtoken`, `multer`, `zod`, `helmet`, `express-rate-limit`, `cookie-parser`, `pino`.
- **Database:** MongoDB 7 (local instance or Docker).
- **PDF Extraction:** `pdfjs-dist` (server-side legacy build) for text coordinate geometry + `tesseract.js` OCR fallback for scanned pages.
- **Testing:** Vitest / Jest, Supertest.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB running locally at `localhost:27017` OR Docker & Docker Compose

### 2. Clone & Install Dependencies

```bash
# In project root
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 3. Environment Setup

Create `.env` files in both root and `server/` (or copy from `.env.example`):

```bash
cp .env.example .env
cp .env.example server/.env
```

Ensure the following variables are configured:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/tce_syllabus_db
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
JWT_SECRET=<YOUR_RANDOM_LONG_SECRET_KEY>
ALLOWED_DOMAIN=tce.edu
CURRENT_REGULATION=26
CURRENT_YEAR=2026
ADMIN_EMAILS=admin@tce.edu,hod.cse@tce.edu
```

### 4. Running MongoDB with Docker (Optional)

If MongoDB is not installed locally:
```bash
docker compose up -d
```
Mongo Express will be available at `http://localhost:8081`.

### 5. Running the Application

```bash
# Run both Backend & Frontend concurrently
npm run dev

# Or run separately:
# Terminal 1: Backend (http://localhost:5000)
npm run dev:server

# Terminal 2: Frontend (http://localhost:5173)
npm run dev:client
```

### 6. Running Tests

```bash
npm test
```

---

## 🔑 Setting up Google OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `TCE Syllabus Validator`.
3. Navigate to **APIs & Services > OAuth consent screen**:
   - Choose **Internal** (if TCE Google Workspace organization allows) or **External**.
   - App Name: `TCE Syllabus Validator`
   - User Support Email: your `@tce.edu` address.
   - Authorized domains: add `tce.edu`.
4. Navigate to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - Name: `TCE Syllabus Validator Client`.
   - **Authorized JavaScript origins:**
     - `http://localhost:5173`
   - **Authorized redirect URIs:**
     - `http://localhost:5173`
5. Copy the generated **Client ID** and paste it into `.env` as `GOOGLE_CLIENT_ID` and in `client/.env` as `VITE_GOOGLE_CLIENT_ID`.

---

## 🏛️ Project Directory Structure

```
├── client/              # React 18 + Vite Frontend
│   ├── src/
│   │   ├── api/         # TanStack Query & Axios API integrations
│   │   ├── components/  # PDF Viewer with overlays, Finding Cards, Review Table
│   │   ├── pages/       # Dashboard, Upload, Review, Report, Admin
│   │   └── utils/       # Coordinate mapper, PDF highlighter helpers
├── server/              # Express Backend & Deterministic Engine
│   ├── src/
│   │   ├── extractor/   # Header/footer filter, section splitter, table parser
│   │   ├── rules/       # THEORY-*, LAB-*, TCP-*, LEGACY-* rule groups
│   │   ├── models/      # User, Submission, Version, RulesConfig, PICatalogue
│   │   └── routes/      # REST API endpoints
│   └── tests/           # Vitest integration and unit test suite
├── fixtures/            # Test PDFs (Legacy MCA sample, Compliant & Broken syllabi)
├── docs/                # Architecture & reference guidelines
└── docker-compose.yml   # Containerized database
```

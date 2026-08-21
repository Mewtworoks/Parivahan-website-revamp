# 🚗 Parivahan-website-revamp

A full-stack repository for the Parivahan Website Revamp project, pre-configured for pair development:
- **Frontend**: React + SCSS (Vite)
- **Backend**: Python (FastAPI / Uvicorn)

---

## 📁 Project Architecture

```text
parivahaan-website-revamp/
├── Frontend/                 # React App (Vite + SCSS)
│   ├── src/
│   │   ├── styles/           # Global SCSS Design System
│   │   │   ├── _variables.scss # Shared colors, typography, spacing, shadows
│   │   │   ├── _mixins.scss    # Flexbox, responsive mixins, button styles
│   │   │   └── global.scss     # Master global stylesheet
│   │   ├── App.jsx           # Main React Portal component
│   │   ├── App.module.scss   # Component styling importing global design tokens
│   │   └── main.jsx          # React DOM entry point
│   ├── index.html            # Vite HTML template with Google Fonts
│   ├── package.json          # React dependencies & scripts
│   └── vite.config.js        # Vite build & dev server config
├── Backend/                  # Python Backend API (FastAPI)
│   ├── main.py               # API entry point with CORS enabled for React
│   ├── requirements.txt      # Python dependencies (fastapi, uvicorn, etc.)
│   ├── .env.example          # Environment variables template
│   └── README.md             # Backend setup guide
├── .gitignore                # Optimized Git ignore for Node & Python
├── .gitattributes            # Line ending normalization across OS
└── README.md                 # Main documentation
```

---

## 🎨 SCSS Design System Rules

1. **Centralized Variables (`Frontend/src/styles/_variables.scss`)**:
   - Primary colors, background neutrals, font sizes, radii, and shadows are defined centrally.
   - Component styles MUST import `@import './styles/variables';` and avoid arbitrary hardcoded colors.

2. **Shared Mixins (`Frontend/src/styles/_mixins.scss`)**:
   - Reusable layouts, flex helpers, glassmorphism, responsive breakpoints (`@include mobile`, `@include tablet`, `@include desktop`) are centralized to maintain visual consistency across all pages.

---

## 🚀 How to Run the Project Locally

### 1️⃣ Run Frontend (React)
```bash
cd Frontend
npm install
npm run dev
```
*Frontend dev server will launch at `http://localhost:3000`.*

### 2️⃣ Run Backend (Python)
```bash
cd Backend
python -m venv venv
# Activate virtual environment (Windows: .\venv\Scripts\activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python main.py
```
*Backend API will run at `http://127.0.0.1:8000` with interactive docs at `http://127.0.0.1:8000/docs`.*

---

## 🤝 GitHub Collaboration Setup

1. **Remote Repository URL**: `https://github.com/Mewtworoks/Parivahan-website-revamp.git`
2. **Push Local Changes**:
   ```bash
   git add .
   git commit -m "feat: setup fullstack repository with React frontend and Python backend"
   git push -u origin main
   ```
3. **Invite Collaborator (Friend)**:
   - Go to GitHub Repository -> **Settings** -> **Collaborators**.
   - Click **Add people** and enter your friend's GitHub username to give them access.

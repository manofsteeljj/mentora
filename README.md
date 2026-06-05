<div align="center">

# 🎓 Mentora

### A Context-Aware LLM-Based Faculty Teaching Assistant

*Capstone Project — Lorma Colleges, College of Computer Studies and Engineering*

[![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?style=flat&logo=laravel&logoColor=white)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?style=flat&logo=php&logoColor=white)](https://php.net)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📖 Overview

**Mentora** is an AI-powered web application designed to reduce the administrative burden on college faculty. It brings together course management, AI-generated assessments, student performance analytics, gradebook and attendance tracking, and a context-aware AI chat assistant — all in a single platform.

The AI assistant is grounded in the instructor's own uploaded course materials using a keyword-scoring Retrieval-Augmented Generation (RAG) pipeline, ensuring responses are relevant to actual course content rather than generic knowledge. Faculty can also connect their Google Classroom account to sync courses, students, assignments, and materials automatically.

> Aligned with **SDG 4** (Quality Education) and **SDG 9** (Innovation and Infrastructure).

---

## ✨ Features

### 🤖 AI Teaching Assistant (RAG-powered Chat)
- Context-aware chat grounded in uploaded course materials
- Attach a specific material to any message for focused responses
- Conversation threading with persistent history
- Auto-detection of quiz/study-guide requests with structured output
- Downloadable question sets as `.docx` files
- Source citations shown on every AI response
- Dual LLM provider support: **OpenRouter** (cloud) or **Ollama** (self-hosted)

### 📚 Course & Material Management
- Create and manage courses with code, name, section, and room
- Upload PDF, DOCX, PPTX, XLSX, and plain text materials
- Automatic PDF text extraction for RAG ingestion
- Google Classroom sync — imports courses, materials (Drive, YouTube, Forms, links), assignments, and student submissions

### 📝 Assessment Automation
- AI-generated multiple choice questions from course materials
- Manual question creation and editing
- Assessment export to `.docx`
- Full submission tracking per student

### 📊 Gradebook & Analytics
- Weighted gradebook with grading period support
- Class record view with per-student scores
- Dashboard overview with course and student statistics
- Admin-level system-wide analytics

### 🗓️ Attendance Tracking
- Per-session attendance (present / absent / late / excused)
- Excuse letter submission and review workflow
- Attendance remarks and audit trail

### 🔐 Authentication
- Email/password registration and login (Laravel Breeze)
- **Google OAuth** — one-click sign-in that also authorizes Google Classroom access
- Email verification and password reset flows
- Secure password confirmation for sensitive actions

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend framework** | Laravel 12.x (PHP 8.2+) |
| **Frontend framework** | React 19 + Vite 7 |
| **Styling** | Tailwind CSS v3, MUI v7 (Material UI), Radix UI |
| **Animation** | Framer Motion 12 |
| **Charts** | Recharts 3 |
| **Icons** | Lucide React |
| **Markdown** | react-markdown + remark-gfm |
| **Toasts** | Sonner |
| **Auth scaffolding** | Laravel Breeze 2.x |
| **OAuth** | Laravel Socialite 5.x (Google) |
| **Google APIs** | google/apiclient 2.x (Classroom + Drive) |
| **PDF parsing** | smalot/pdfparser 2.x |
| **HTTP client** | Axios + Laravel HTTP Client |
| **Database** | MySQL / MariaDB (SQLite supported) |
| **Queue / Cache / Session** | Database driver |

---

## 🤖 AI Provider Configuration

Mentora supports two LLM backends, switchable with a single environment variable.

### OpenRouter (default — cloud)
Uses the OpenAI-compatible API. Free models are available.

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=google/gemma-3-12b-it:free
OPENROUTER_SITE_URL=http://localhost
OPENROUTER_APP_NAME=Mentora
```

### Ollama (local / self-hosted)
Runs entirely on your machine. No API key required.

```env
AI_PROVIDER=local
LOCAL_AI_URL=http://localhost:11434
LOCAL_AI_MODEL=llama3:8b-instruct-q4_0
```

---

## 🚀 Getting Started

### Prerequisites

- PHP 8.2+
- Composer
- Node.js 18+ and npm
- MySQL or MariaDB
- (Optional) [Ollama](https://ollama.ai) for local AI

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your-org/mentora.git
cd mentora
```

**2. Install PHP dependencies**

```bash
composer install
```

**3. Install Node dependencies**

```bash
npm install
```

**4. Configure the environment**

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` with your database credentials, AI provider settings, Google OAuth keys, and mail configuration.

**5. Run migrations**

```bash
php artisan migrate
```

**6. Link the storage disk**

```bash
php artisan storage:link
```

**7. Build frontend assets**

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
```

**8. Start the development server**

```bash
php artisan serve
```

Visit `http://localhost:8000`.

---

## 🔑 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `APP_URL` | Application base URL | `http://localhost` |
| `DB_CONNECTION` | Database driver | `mysql` |
| `DB_DATABASE` | Database name | `mentora` |
| `AI_PROVIDER` | LLM backend (`openrouter` or `local`) | `openrouter` |
| `AI_TIMEOUT` | Request timeout in seconds | `120` |
| `AI_RETRIES` | Retry attempts on failure | `2` |
| `AI_EXECUTION_TIME` | PHP max execution time for AI requests | `300` |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `OPENROUTER_MODEL` | Model to use on OpenRouter | `google/gemma-3-12b-it:free` |
| `LOCAL_AI_URL` | Ollama base URL | `http://localhost:11434` |
| `LOCAL_AI_MODEL` | Ollama model name | `llama3:8b-instruct-q4_0` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | — |
| `MAIL_MAILER` | Mail driver | `log` |

See `.env.example` for the full list.

---

## 🗂️ Project Structure

```
mentora/
├── app/
│   ├── Http/
│   │   └── Controllers/
│   │       ├── AIController.php          # LLM question generation
│   │       ├── ChatController.php        # AI chat + RAG pipeline
│   │       ├── CourseController.php
│   │       ├── MaterialController.php    # Upload + text extraction
│   │       ├── AssessmentController.php
│   │       ├── GradingController.php
│   │       ├── GradebookController.php
│   │       ├── StudentController.php
│   │       ├── AttendanceController.php
│   │       ├── DashboardController.php
│   │       ├── FacultyController.php
│   │       ├── GoogleAuthController.php
│   │       └── GoogleClassroomController.php
│   ├── Models/                           # Eloquent models
│   └── Services/
│       └── GoogleClassroomService.php    # Classroom + Drive sync
├── database/
│   └── migrations/                       # All schema migrations
├── resources/
│   ├── js/
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx         # AI chat UI with RAG attachment
│   │   │   ├── ContextPanel.jsx          # Right sidebar (materials + quick actions)
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MyCourses.jsx
│   │   │   ├── CourseMaterials.jsx
│   │   │   ├── GradingSystem.jsx
│   │   │   ├── Attendance.jsx
│   │   │   └── ...
│   │   └── app.jsx
│   └── views/                            # Blade templates
├── routes/
│   ├── web.php
│   └── auth.php
├── .env.example
└── vite.config.js
```

---

## 🗄️ Database Schema (Summary)

| Table | Purpose |
|---|---|
| `users` | Faculty accounts with Google OAuth fields |
| `courses` | Courses owned by faculty; supports Google Classroom sync |
| `materials` | Uploaded files and Classroom materials; stores extracted text for RAG |
| `assessments` | Quizzes/exams per course |
| `questions` | MCQ/essay questions with JSON options |
| `students` | Students enrolled per course |
| `submissions` | Student assessment submissions and grades |
| `grades` | Per-question scores |
| `chats` | Individual AI chat messages with responses |
| `conversations` | Chat threads per user |
| `attendances` | Daily attendance records per student |
| `excuse_letters` | Excuse letter submissions with review workflow |
| `gradebook_assessments` | Weighted gradebook assessments per period |
| `gradebook_grades` | Student scores for gradebook assessments |

---

## 🔗 Google Classroom Integration

Sign in with Google to unlock full Classroom sync. The OAuth flow requests all required scopes in a single step.

**What syncs:**
- Courses where you are a teacher
- Enrolled students (name, email, photo)
- Coursework (assignments) with due dates and max points
- Student submissions and grades
- Course materials — Drive files (with PDF text extraction), YouTube links, Google Forms, and plain links

**Sync endpoints:**
- `POST /api/google/classroom/import` — import courses only
- `POST /api/google/classroom/sync` — full sync (everything above)
- `GET /api/google/classroom/sync-status` — last sync timestamp

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message to the AI assistant |
| `GET` | `/api/chat/history/{id}` | Load conversation history |
| `GET` | `/api/chat/conversations` | List all conversations |
| `POST` | `/api/chat/export-docx` | Export questions as DOCX |
| `GET` | `/api/courses` | List faculty courses |
| `GET` | `/api/materials` | List all materials |
| `POST` | `/api/materials` | Upload a material |
| `GET` | `/api/materials/{id}/download` | Download/view a material file |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `POST` | `/api/google/classroom/sync` | Trigger Classroom sync |
| `GET` | `/api/attendance/{courseId}` | Get attendance records |

---

## 👥 Contributors

| Name | Role |
|---|---|
| **Project Team** | Capstone development |
| [@ArronRyyel](https://github.com/ArronRyyel) | Contributor |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ at Lorma Colleges — College of Computer Studies and Engineering</sub>
</div>

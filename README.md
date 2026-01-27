# AI Benchmark - LLM Model Evaluation System

English | [中文](./README.md)

A professional Large Language Model (LLM) evaluation and scoring system built with Next.js 16, TypeScript, Tailwind CSS, and SQLite. Features batch inference, multi-dimensional expert scoring, arena battles, and more — designed to help researchers systematically evaluate and compare LLM performance.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [User Guide](#user-guide)
  - [Login](#1-login)
  - [Manage Questions](#2-manage-questions)
  - [Manage Models](#3-manage-models)
  - [Manage Scoring Dimensions](#4-manage-scoring-dimensions)
  - [Batch Inference](#5-batch-inference)
  - [Batch Scoring](#6-batch-scoring)
  - [Expert Scoring](#7-expert-scoring)
  - [Arena Battle](#8-arena-battle)
  - [Batch Arena](#9-batch-arena)
  - [Data Export](#10-data-export)
  - [CSV Data Import](#11-csv-data-import)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [FAQ](#faq)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Features

### Core Features

- **Model Management** — Add, edit, and delete LLM models; supports all OpenRouter-compatible models
- **Question Management** — Create and manage evaluation question sets with CSV bulk import
- **Scoring Dimensions** — Define custom scoring dimensions with corresponding evaluation prompts
- **Batch Inference** — Send all questions to a specified model and collect responses in bulk
- **Multi-Dimensional Scoring** — Use an expert model to automatically score responses across multiple dimensions
- **Arena Battle** — Cross-review by multiple expert models with arbitration when opinions diverge
- **Data Export** — Export evaluation results to Excel files

### Task Management

- Concurrent execution with configurable maximum concurrency
- Task queues support pause / resume / cancel operations
- Automatic retry on failure with exponential backoff strategy
- Real-time progress tracking and error logging

### Internationalization

- Bilingual support with Chinese/English toggle (defaults to English)
- One-click language switch in the navigation bar; preference persists in localStorage
- All UI text and API prompts are fully bilingual

### UI Features

- Responsive design for desktop and mobile
- Virtual scrolling for smooth rendering of large lists
- Paginated data loading for optimized performance

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 4 |
| Database | SQLite (Node.js built-in `node:sqlite`) |
| LLM API | OpenRouter API |
| UI Components | React 19, React Virtuoso |
| Data Export | SheetJS (xlsx) |

---

## System Requirements

- **Node.js** >= 22.0.0 (requires built-in `node:sqlite` module)
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **OpenRouter API Key** (for calling LLM models)
- OS: Windows / macOS / Linux

---

## Quick Start

### 1. Clone or Download

```bash
git clone <repository-url>
cd ai-benchmark
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env.local` file in the project root:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
EXPERT_MODEL=moonshotai/kimi-k2-thinking
ACCESS_PASSWORD=your_password_here
```

> **Note:** You can also configure via `config.json`. See [Configuration](#configuration) for details.

### 4. Start Development Server

```bash
npm run dev
```

### 5. Access the System

Open your browser and navigate to [http://localhost:3000](http://localhost:3000). Enter your configured password to log in.

---

## Configuration

The system supports two configuration methods. Priority: `config.json` > `.env.local`.

### Option 1: Environment Variables (.env.local)

```env
# OpenRouter API key (required)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx

# Expert scoring model (optional, defaults to moonshotai/kimi-k2-thinking)
EXPERT_MODEL=moonshotai/kimi-k2-thinking

# Access password (optional, leave empty to disable authentication)
ACCESS_PASSWORD=your_password
```

### Option 2: Configuration File (config.json)

```json
{
  "api": {
    "key": "sk-or-v1-xxxxxxxxxxxxxxxx",
    "baseUrl": "https://openrouter.ai/api/v1",
    "expertModel": "moonshotai/kimi-k2-thinking"
  },
  "security": {
    "accessPassword": "your_password"
  },
  "server": {
    "port": 3000
  }
}
```

### Configuration Reference

| Setting | Required | Description |
|---------|----------|-------------|
| `api.key` / `OPENROUTER_API_KEY` | Yes | OpenRouter API key for calling LLM models |
| `api.baseUrl` | No | API base URL, defaults to `https://openrouter.ai/api/v1` |
| `api.expertModel` / `EXPERT_MODEL` | No | Model used for expert scoring, defaults to `moonshotai/kimi-k2-thinking` |
| `security.accessPassword` / `ACCESS_PASSWORD` | No | System access password; leave empty to disable login |

> **Security Note:** `config.json` and `.env.local` contain sensitive information and are excluded in `.gitignore`. Do not commit them to version control.

---

## User Guide

### 1. Login

- Navigate to `http://localhost:3000` — the system redirects to the login page automatically
- Enter the configured access password to log in
- Login state persists for 30 days via cookie
- If `ACCESS_PASSWORD` is not set, no login is required

### 2. Manage Questions

**Path:** Navbar → "Question Management" (`/settings/questions`)

1. Click the add button on the page
2. Enter the evaluation question content
3. Click save
4. Existing questions can be edited and deleted

> **Tip:** Bulk import from CSV files is supported. See [CSV Data Import](#11-csv-data-import).

### 3. Manage Models

**Path:** Navbar → "Model Management" (`/settings/models`)

1. Click the add button
2. Enter the model name (must use an OpenRouter-compatible model identifier)
3. Click save

**Model name examples:**
- `openai/gpt-4o`
- `anthropic/claude-sonnet-4`
- `google/gemini-2.5-pro`
- `moonshotai/kimi-k2-thinking`
- `deepseek/deepseek-r1`

> **Tip:** See the full model list at [OpenRouter Models](https://openrouter.ai/models).

### 4. Manage Scoring Dimensions

**Path:** Navbar → "Dimension Management" (`/settings/dimensions`)

The system includes 5 default scoring dimensions:

| Dimension | Description |
|-----------|-------------|
| Accuracy | Evaluates the correctness of the response |
| Completeness | Evaluates whether the response covers all aspects of the question |
| Clarity | Evaluates how clearly the response is expressed |
| Practicality | Evaluates how helpful the response is in practice |
| Innovation | Evaluates whether the response provides unique or innovative insights |

**Custom Dimensions:**
1. Add a new dimension on the dimension management page
2. Enter the dimension name and evaluation prompt
3. The evaluation prompt serves as guidance for the expert model during scoring

### 5. Batch Inference

**Path:** Home → Select a model → Model detail page → "Start Test" or Navbar → "Batch Tasks" (`/admin/tasks`) → "Inference Tasks" (`/admin/tasks/inference`)

**Steps:**
1. Click a target model on the home page to enter its detail page
2. Click the "Start Test" button
3. The system sends all questions to the model and collects responses in batch
4. Monitor inference queue progress on the "Inference Tasks" page

**Task Management:**
- View real-time progress (completed / total tasks)
- Pause running tasks
- Resume paused tasks
- Cancel tasks
- Retry failed tasks
- View error details

### 6. Batch Scoring

**Path:** Model detail page → "Start Scoring" or Navbar → "Batch Tasks" (`/admin/tasks`)

**Steps:**
1. Click "Start Scoring" on the model detail page
2. The system uses the configured expert model to score all responses across all dimensions
3. Monitor scoring queue progress on the "Batch Tasks" page
4. After completion, view per-dimension scores on the answer detail page

**Scoring Mechanism:**
- The expert model receives the question, answer, and dimension prompt
- Scores are output in XML format: `<score>score_value</score>`
- The system automatically extracts scores (with fallback parsing for multiple formats)
- Each answer receives one score per dimension

### 7. Expert Scoring

**Path:** Navbar → "Expert Scoring" (`/expert`)

A standalone expert scoring interface for immediate evaluation:

1. Enter or paste the question content
2. Enter or paste the answer content
3. Select the dimension to evaluate
4. The system calls the expert model and returns the scoring result

### 8. Arena Battle

**Path:** Navbar → "Arena" (`/arena`)

Multi-expert cross-review feature:

1. Select two expert models (Expert A and Expert B)
2. Select an arbitrator model (Expert C)
3. Select the answer to evaluate
4. The system initiates multi-round battles:
   - Each round, both experts independently evaluate the answer
   - If both experts agree, the battle concludes
   - If they disagree, proceed to the next round
   - When the maximum rounds are reached without agreement, the arbitrator makes the final decision

**View History:** Navbar → "Battle History" (`/arena/history`)

### 9. Batch Arena

**Path:** Navbar → "Batch Arena" (`/admin/arena-batch`)

Execute arena battles in batch:

1. Select three expert models (Expert A / B / C)
2. Set maximum rounds and concurrency
3. The system automatically runs arena battles for all pending answers
4. Supports pause / resume / cancel operations

### 10. Data Export

**Path:** Navbar → Data Export page (`/export`)

- Export evaluation results to Excel (.xlsx) files
- Includes model info, questions, answers, and per-dimension scores

### 11. CSV Data Import

The system provides a Python script for bulk importing questions and answers from CSV files.

**CSV File Format:**

| Question | Model A | Model B | Model C | ... |
|----------|---------|---------|---------|-----|
| Question 1 | Model A's answer | Model B's answer | Model C's answer | ... |
| Question 2 | ... | ... | ... | ... |

**Usage:**

```bash
python import_csv.py
```

> **Note:** The script reads `8道题×13个答案.csv` by default. To import a different file, modify the `csv_file` variable in the script.

**Import Behavior:**
- Automatically creates models and questions that don't exist
- Skips duplicate data
- Outputs import statistics

---

## Project Structure

```
ai-benchmark/
├── app/                            # Next.js App Router pages and API
│   ├── api/                        # Backend API routes
│   │   ├── answers/                # Answer CRUD
│   │   ├── arena/                  # Arena features
│   │   ├── arena-batch-queue/      # Batch arena queue
│   │   ├── config/                 # Configuration endpoint
│   │   ├── dimensions/             # Scoring dimension CRUD
│   │   ├── expert-score/           # Batch expert scoring
│   │   ├── expert-score-single/    # Single dimension scoring
│   │   ├── inference-queue/        # Inference queue management
│   │   ├── login/                  # Authentication
│   │   ├── models/                 # Model CRUD
│   │   ├── questions/              # Question CRUD
│   │   ├── score/                  # Calculate model scores
│   │   ├── scores/                 # Score retrieval
│   │   ├── task-queue/             # Scoring queue management
│   │   └── test/                   # Health check
│   ├── admin/                      # Admin pages
│   │   ├── tasks/                  # Scoring task management
│   │   │   └── inference/          # Inference task management
│   │   └── arena-batch/            # Batch arena management
│   ├── answers/                    # Answer detail pages
│   ├── arena/                      # Arena pages
│   │   └── history/                # Battle history
│   ├── expert/                     # Expert scoring page
│   ├── export/                     # Data export page
│   ├── login/                      # Login page
│   ├── models/                     # Model detail pages
│   ├── settings/                   # Settings pages
│   │   ├── questions/              # Question management
│   │   ├── models/                 # Model management
│   │   └── dimensions/             # Dimension management
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Home page
│   └── globals.css                 # Global styles
├── components/                     # React components
│   ├── Navbar.tsx                  # Navigation bar
│   ├── LanguageSwitcher.tsx        # Language toggle button
│   └── LoadingSpinner.tsx          # Loading indicator
├── lib/                            # Core libraries
│   ├── i18n/                       # Internationalization module
│   │   ├── context.tsx             # LanguageProvider and useTranslation hook
│   │   ├── server.ts               # Server-side translation utility
│   │   └── locales/                # Language packs
│   │       ├── en.ts               # English translations
│   │       └── zh.ts               # Chinese translations
│   ├── db.ts                       # SQLite database initialization
│   ├── config.ts                   # Configuration manager (singleton)
│   ├── queries.ts                  # Database query operations
│   ├── taskQueue.ts                # Task queue execution engine
│   ├── openrouter.ts               # OpenRouter API wrapper
│   └── arenaBatchQueue.ts          # Batch arena execution engine
├── types/                          # TypeScript type definitions
│   └── xlsx.d.ts                   # Excel export types
├── middleware.ts                   # Authentication middleware
├── config.json                     # Application configuration
├── import_csv.py                   # CSV data import script
├── package.json                    # Project dependencies
├── tsconfig.json                   # TypeScript configuration
├── tailwind.config.ts              # Tailwind CSS configuration
├── next.config.js                  # Next.js configuration
└── postcss.config.js               # PostCSS configuration
```

---

## API Reference

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Verify password and set auth cookie |

### Question Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | Get question list |
| POST | `/api/questions` | Create a new question |
| PUT | `/api/questions` | Update a question |
| DELETE | `/api/questions` | Delete a question |

### Model Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | Get model list |
| POST | `/api/models` | Create a new model |
| PUT | `/api/models` | Update a model |
| DELETE | `/api/models` | Delete a model |

### Answer Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/answers` | Get answer list (paginated) |
| GET | `/api/answers/count` | Get total answer count |
| POST | `/api/answers` | Create a new answer |
| DELETE | `/api/answers` | Delete an answer |

### Scoring Dimensions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dimensions` | Get scoring dimension list |
| POST | `/api/dimensions` | Create a new dimension |
| PUT | `/api/dimensions` | Update a dimension |
| DELETE | `/api/dimensions` | Delete a dimension |

### Scoring Operations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scores` | Get scoring results |
| POST | `/api/scores` | Create a scoring record |
| POST | `/api/score` | Trigger model score calculation |
| POST | `/api/expert-score` | Batch expert scoring |
| POST | `/api/expert-score-single` | Single dimension expert scoring |

### Task Queues

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/task-queue` | Create a scoring batch task |
| GET | `/api/task-queue/[id]` | Query task queue status |
| POST | `/api/inference-queue` | Create an inference batch task |
| GET | `/api/inference-queue/[id]` | Query inference queue status |

### Arena

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/arena/experts` | Get expert model list |
| POST | `/api/arena/experts` | Add an expert model |
| POST | `/api/arena/sessions` | Create an arena session |
| POST | `/api/arena/battle` | Execute one battle round |
| POST | `/api/arena/judge` | Arbitration judgment |
| POST | `/api/arena-batch-queue` | Create a batch arena task |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get public configuration |
| GET | `/api/test` | Health check |

---

## Database Schema

The system uses an SQLite database (file: `benchmark.db`), automatically created with the following tables:

### Core Tables

```
questions           Questions table
├── id              INTEGER PRIMARY KEY
└── content         TEXT NOT NULL

models              Models table
├── id              INTEGER PRIMARY KEY
├── name            TEXT NOT NULL UNIQUE
└── average_score   TEXT (JSON-formatted score data)

answers             Answers table
├── id              INTEGER PRIMARY KEY
├── question_id     INTEGER → questions(id) ON DELETE CASCADE
├── model_id        INTEGER → models(id) ON DELETE CASCADE
├── content         TEXT NOT NULL
└── created_at      DATETIME

dimensions          Scoring dimensions table
├── id              INTEGER PRIMARY KEY
├── name            TEXT NOT NULL UNIQUE
└── prompt          TEXT NOT NULL

scores              Scores table
├── id              INTEGER PRIMARY KEY
├── answer_id       INTEGER → answers(id) ON DELETE CASCADE
├── dimension_id    INTEGER → dimensions(id) ON DELETE CASCADE
├── score           TEXT NOT NULL
├── created_at      DATETIME
└── UNIQUE(answer_id, dimension_id)
```

### Queue Tables

```
task_queue          Scoring queue table
├── id, status, total_tasks, completed_tasks, failed_tasks
├── current_task, error_message, max_concurrency
└── created_at, started_at, completed_at

task_items          Scoring task items table
├── id, queue_id, answer_id, dimension_id
├── status, error_message
└── created_at, completed_at

inference_queue     Inference queue table (same structure as task_queue)

inference_tasks     Inference task items table
├── id, queue_id, question_id, model_id
├── status, error_message
└── created_at, completed_at

arena_batch_queue   Batch arena queue table
├── (same structure as task_queue)
├── max_rounds, expert_a_id, expert_b_id, expert_c_id
└── ...

arena_batch_tasks   Batch arena task items table
├── id, queue_id, question_id, answer_id, session_id
├── status, current_round, is_agreed, needs_judgment
└── error_message, created_at, completed_at
```

### Task Status Reference

| Status | Description |
|--------|-------------|
| `pending` | Waiting for execution |
| `running` | Currently executing |
| `completed` | Successfully completed |
| `failed` | Execution failed |
| `cancelled` | Cancelled |
| `paused` | Paused |

---

## FAQ

### Q: Error "node:sqlite" module not found on startup?

The built-in `node:sqlite` module requires Node.js 22 or later. Upgrade your Node.js version:

```bash
node --version  # Check your version
```

### Q: API calls fail with "API Key not configured"?

Ensure that `api.key` in `config.json` or `OPENROUTER_API_KEY` in `.env.local` is set to a valid OpenRouter API key.

### Q: Scoring results are empty or cannot be parsed?

The system automatically extracts scores from expert model responses, supporting these formats:
1. XML format (preferred): `<score>85</score>`
2. Chinese format: `分数：85`
3. English format: `Score: 85`
4. Fallback: extracts the first number in the 0-100 range from the response

If the model response format is abnormal, check whether the scoring dimension prompt is clear.

### Q: High failure rate in batch tasks?

- Check your OpenRouter API key balance
- Lower the concurrency level (default is 3)
- The system has built-in exponential backoff retry (1s → 2s → 4s), which usually recovers automatically
- Check the error logs on the task detail page for specific failure reasons

### Q: Where is the database file?

The database file `benchmark.db` is located in the project root directory and is automatically created on first startup. This file is excluded in `.gitignore`.

### Q: How to reset all data?

Delete the `benchmark.db` file in the project root. The system will automatically create a new empty database on restart.

### Q: How to change the expert scoring model?

Modify `EXPERT_MODEL` in `.env.local` or `api.expertModel` in `config.json`, then restart the service. You can also view the current configuration through the config API endpoint (`/api/config`).

---

## Production Deployment

### Build

```bash
npm run build
```

### Start

```bash
npm start
```

### Notes

- Ensure Node.js >= 22 in the production environment
- The SQLite database file requires write permissions
- `config.json` and `.env.local` should not be included in the deployment package; configure them separately on the server
- Using PM2 or similar process managers is recommended

---

## License

[ISC](LICENSE)

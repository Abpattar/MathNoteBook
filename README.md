# AI Math Notebook

An intelligent, interactive math notebook designed for middle and high school students. Write or draw math equations naturally by hand, type word problems, and receive step-by-step, mathematically verified solutions with contextual explanations.

---

## ✨ Features

- **🖊️ Live Handwriting & Canvas Recognition**: Draw equations naturally using pen and eraser tools with instant stroke undo/redo. A debounced background vision OCR automatically transcribes your drawings into clean math.
- **🔍 100% Formally Verified Steps**: SymPy serves as the single source of truth for algebraic calculations and step-by-step equivalence verification. The LLM is never the calculator.
- **📚 Educational, Goal-Oriented Explanations**: Every step clearly explains **what** is being done and **why** (e.g. collecting variable terms, isolating constants, dividing coefficients, or taking square roots).
- **💡 Complex Problem Support**:
  - **Quadratic Equations**: Pure quadratics ($4x^2 + 5 = 2x^2 + 20$), factoring ($x^2 - 5x + 6 = 0$), and the quadratic formula ($ax^2 + bx + c = 0$).
  - **Systems of Equations**: Linear and non-linear systems (e.g., $x^2 + y = 30; y = 5$ or $x + y = 30; x - y = 10$).
  - **Radical Equations**: Multi-step radicals with extraneous root verification ($\sqrt{x + 4} = 3$).
  - **Multi-step Linear Equations**: Expressions with fractions and distributed terms ($3(x - 2) + 4 = 2(x + 5)$).
  - **Multivariable Guidance**: When a single equation contains two variables (e.g. $x^2 + y = 30; x = ?$), the notebook isolates the requested unknown and clearly explains that a second equation is required to determine unique numbers.
- **📖 Dual View Modes**: Switch seamlessly between interactive **Notebook Mode** (step-by-step guided reveal with hint ladders) and **Textbook Mode** (comprehensive full-derivation overview).
- **🎨 Strict Pedagogical Rendering**: All equations and solutions are rendered using KaTeX. Students never see raw programming syntax (`^`, `\frac`, `sqrt(`, `**`).

---

## 🛠️ Architecture & Tech Stack

```
AI Math Notebook
├── Frontend (React 18 + TypeScript + Vite)
│   ├── Interactive Drawing Canvas (Pointer events, stroke smoothing, SVG export)
│   ├── Unified Problem Input (Typed math, word problems, live canvas sync)
│   ├── Step-by-Step Solution Viewer (KaTeX rendering, step navigation, hints)
│   └── Mode Toggle (Notebook vs. Textbook layout)
│
└── Backend (FastAPI + Python 3.12)
    ├── Handwriting Recognition (/api/recognize via Groq Vision API)
    ├── Problem Interpretation (/api/interpret into structured AST)
    ├── Formal Solver Engine (/api/solve powered by SymPy verification)
    └── Pedagogical Teacher (/api/teaching contextual step explanation)
```

- **Frontend**: React 18, TypeScript, Vite, KaTeX, CSS Modules
- **Backend**: FastAPI, Python 3.12, SymPy (CAS), Pydantic v2, Uvicorn, httpx
- **AI / Vision**: Groq Vision (`qwen/qwen3.8-27b`) for handwritten math OCR and pedagogical explanation enrichment

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+) and **npm**
- **Python** (v3.11+) and **pip**
- (Optional) **Groq API Key** for handwriting OCR and word problem parsing

---

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -e .
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Add your API key inside `.env`:
   ```ini
   LLM_API_KEY=your_groq_api_key_here
   VISION_LLM_API_KEY=your_groq_api_key_here
   ```

5. Start the backend development server:
   ```bash
   uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The backend will be live at `http://localhost:8000`.

---

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## 🧪 Running Tests

The test suite validates mathematical equivalence, solver correctness across topic groups, and checks that raw programming syntax is never exposed to students.

Run all tests from the backend directory:
```bash
cd backend
.venv/bin/pytest -v
```

Tests cover:
- Step-by-step linear, quadratic, radical, and system solving
- Extraneous root detection and zero product property validation
- Raw syntax scanning (`^`, `\frac`, `sqrt(`, `**`)
- Guided practice mode and hint ladder delivery

---

## 📂 Project Structure

```
MathAI/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI routes (/recognize, /interpret, /solve)
│   │   ├── solver/       # SymPy algebraic engine & equivalence verification
│   │   ├── teaching/     # Contextual explanations and hint generation
│   │   ├── practice/     # Student attempt checking & misconception detection
│   │   └── utils/        # Topic registry & mathematical validators
│   └── tests/            # Pytest test suite & regression fixtures
│
├── frontend/
│   ├── src/
│   │   ├── components/   # MathCanvas, MathDisplay, TypedInput, ModeToggle
│   │   ├── hooks/        # Drawing, stroke management, and API integration
│   │   ├── styles/       # Notebook, textbook, canvas, and global themes
│   │   └── utils/        # KaTeX math rendering and stroke conversion
│   └── package.json
│
├── AGENTS.md             # Core design principles and non-negotiable rules
├── PLAN.md               # Architecture design and milestone roadmap
└── PROGRESS.md           # Implementation history and phase tracking
```

---

## 📜 Pedagogical Principles

1. **Structured Expression as Source of Truth**: Internal math is maintained in an AST / SymPy representation; display strings are generated from it.
2. **SymPy Verification**: Every single transformation is mathematically verified before being displayed to the student.
3. **No Unverified Guesses**: Ambiguous intent or unconstrained variables are explained clearly rather than silently guessed.
4. **Clean Presentation**: All student-facing math is typeset with KaTeX. Raw source code and programming syntax are strictly forbidden.

---

## 📄 License

MIT License. Feel free to use and contribute!

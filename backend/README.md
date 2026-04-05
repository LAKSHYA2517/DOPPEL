# Twin Agent Backend ⚙️

The backend service powering the Twin Agent intelligence. Built with FastAPI and backed by SQLite.

## Core Services
1. **GitHub Service:** Connects to GitHub API to track push events and coding streaks.
2. **LeetCode Service:** Connects to LeetCode GraphQL endpoints to track problem-solving streaks.
3. **SSV Service:** Builds the Student State Vector, a comprehensive JSON payload representing the student's current workload and mental state.
4. **Gemini Service:** Prompts Google Gemini with the SSV to autonomously generate personalized daily schedules.

## 🚀 Setup Instructions

1. Navigate to this directory:
   ```bash
   cd backend
   ```
2. Create and activate a Virtual Environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Setup your Environment Variables (`.env`):
   ```env
   DATABASE_URL=sqlite:///./twin_agent.db
   SECRET_KEY=your_secret_key
   GEMINI_API_KEY=your_google_genai_key
   ```
5. Run the server:
   ```bash
   python -m uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`.

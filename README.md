# DOPPEL 

An advanced, AI-driven personal companion and scheduler designed to help you stay focused, organized, and accountable. By integrating directly with your developer profiles (GitHub, LeetCode) and understanding your academic syllabus, DOPPEL acts as an intelligent accountability buddy that monitors your stress, sleep, and learning metrics perfectly.

##  Features

- **Personalized Dashboard:** A rich, dynamic UI displaying real-time metrics including your Coding Streak, Focus Score, Stress Index, and Sleep Deficit.
- **AI-Driven Dynamic Scheduling:** Upload your course syllabus (text or PDF), set a deadline, and use the Google Gemini API to generate a personalized daily study timeline.
- **Auto-Verification:** Automatically verify programming and repository tasks via GitHub and LeetCode API synchronizations. 
- **Missed Task Adjustment:** The AI will seamlessly restructure your future schedule to account for any missed tasks or study blocks to ensure you still hit your syllabus deadlines.
- **NLP Daily Check-ins:** Chat with your agent, provide a quick summary of your day ("I slept 8 hours and finished leetcode"), and let the server intelligently extract metrics to adjust DOPPEL's state.
- **Customizable Interface:** Easily personalize your active profile and dynamically change the workspace's accent colors with the selection persisting instantly.

##  Getting Started

### Prerequisites
Need Python 3.10+ and Node.js v18+.

### Setup

1. Start the Backend API (see `backend/README.md`)
2. Start the Frontend React App (see `frontend/README.md`)
3. Connect your API Integrations on the Settings tab.

### Maintainer Note
Last verified setup flow: 2026-04-18.

##  Privacy
Your `twin_agent.db` and environment keys (`.env`) are fully separated and ignored from version control to prevent any personal scheduling constraints or repository secrets from leaking.

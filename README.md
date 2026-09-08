# Kriton Analytics

Kriton Analytics is a full-stack automated data analytics pipeline and reporting tool. It allows users to upload CSV, Excel, or JSON datasets and automatically generates data insights, visualizations, and narrative reports powered by Google's Gemini AI. The application processes the data, builds an interactive dashboard, and exports a set of downloadable artifacts.

## System Architecture

The application is built using a modern full-stack JavaScript architecture:

* **Frontend:** React 19 with Vite, styled using Tailwind CSS and Motion for animations. The frontend uses Recharts for data visualization.
* **Backend:** Express.js (Node.js) server running on port 3000. It handles file uploads, orchestrates the AI processing pipeline, generates PDF reports using `pdfkit`, and communicates with the frontend via Server-Sent Events (SSE).
* **AI Integration:** Google Gemini API (`@google/genai`) is used extensively for data profiling, generating dashboard specifications, and writing the final narrative executive summary.
* **Delivery:** The current email route records a delivery request, but a mail provider integration is not yet connected.

## Core Pipeline & Workflow

The core functionality of Kriton Analytics operates as a multi-stage pipeline:

1. **Upload Phase:**
   - The user uploads a CSV, Excel, or JSON file via the frontend (`src/components/UploadForm.tsx`).
   - The Express backend (`server.ts`) receives the file via `multer`, stores a tokenized job, and responds with a unique `jobId`.

2. **Connection & Cleaning Phase:**
   - The frontend connects to the backend using Server-Sent Events (SSE) at `/api/job/:jobId/stream`. This connection is used to push real-time status updates and logs to the client.
   - The backend uses `papaparse` or `xlsx` to parse the uploaded file into JSON rows.
   - It computes basic statistics (rows, columns, null counts, min/max) and sends a sample of the data to Gemini to formulate a "cleaning plan".
   - The data is cleaned (e.g., removing outliers, handling missing values) based on the AI's recommendations.

3. **Planning & Dashboard Phase:**
   - The cleaned data schema is sent to Gemini to design a dashboard. Gemini returns a structured JSON specification (`DashboardSpec`) detailing which KPIs to calculate and which charts to render.
   - The backend streams this specification to the frontend.
   - The frontend's `DashboardView.tsx` receives the spec, computes the actual KPI values, and renders the charts using `recharts`.
   - The backend uses `chartjs-node-canvas` to natively render high-fidelity charts in the background without needing a client-side screenshot.

4. **Narrative & Report Generation Phase:**
   - Concurrently with the dashboard rendering, the backend sends the data statistics and dashboard specification to Gemini to write a comprehensive Markdown-formatted Executive Summary.
   - The backend combines the AI narrative and natively generated charts into a formatted PDF using `pdfkit`.

5. **Delivery Phase:**
   - The pipeline transitions to a "complete" state.
   - The user can download the individual artifacts (CSV, PDF, interactive HTML, profiling HTML, and PNG when available) or a ZIP archive containing everything.
   - The email route currently acknowledges and logs a delivery request; it does not send mail until a provider is configured.

## Features in Detail

* **Real-time Log Viewer:** A sliding terminal window at the bottom of the screen displays real-time SSE logs from the backend processing pipeline.
* **Graceful Error Handling:** If the pipeline fails at the AI generation stage (e.g., rate limits), it safely falls back to a generic report. If it fails during email delivery, it pauses in a specific `delivery_error` state, allowing the user to retry without re-uploading the data.
* **Dark/Light Mode:** A robust theming system built on Tailwind's `dark:` classes, toggled via `ThemeToggle.tsx`.
* **Ambient Backgrounds:** Framer Motion is used to create a slow-moving, aesthetically pleasing background gradient (`AmbientBackground.tsx`).


## Security & Reliability
- **Strict Session Isolation:** Job status, SSE, downloads, chat, refresh, email, and deletion endpoints require the unique `jobToken` generated upon upload.
- **Safe Data Cleaning:** The system uses strict JSON-based operations for data cleaning (handled natively in TypeScript via `applyCleaningPlan()`), completely avoiding dangerous `eval()` or code-execution pathways.

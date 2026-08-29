# Kriton Analytics

Kriton Analytics is a full-stack automated data analytics pipeline and reporting tool. It allows users to upload raw CSV datasets and automatically generates comprehensive data insights, visualizations, and narrative reports powered by Google's Gemini AI. The application processes the data, builds an interactive dashboard, exports artifacts, and can securely email a final analytics package to the user.

## System Architecture

The application is built using a modern full-stack JavaScript architecture:

* **Frontend:** React 18 with Vite, styled using Tailwind CSS and Framer Motion for smooth animations. The frontend uses Recharts for data visualization.
* **Backend:** Express.js (Node.js) server running on port 3000. It handles file uploads, orchestrates the AI processing pipeline, generates PDF reports using `pdfkit`, and communicates with the frontend via Server-Sent Events (SSE).
* **AI Integration:** Google Gemini API (`@google/genai`) is used extensively for data profiling, generating dashboard specifications, and writing the final narrative executive summary.
* **Email Delivery:** Gmail API via OAuth2 and `nodemailer` for composing and dispatching emails with attachments.

## Core Pipeline & Workflow

The core functionality of Kriton Analytics operates as a multi-stage pipeline:

1. **Upload Phase:**
   - The user provides an email address and uploads a CSV file via the frontend (`src/components/UploadForm.tsx`).
   - The Express backend (`server.ts`) receives the file via `multer`, stores it in a temporary in-memory job queue (`Map`), and responds with a unique `jobId`.

2. **Connection & Cleaning Phase:**
   - The frontend connects to the backend using Server-Sent Events (SSE) at `/api/job/:jobId/stream`. This connection is used to push real-time status updates and logs to the client.
   - The backend uses `papaparse` to parse the CSV into JSON.
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
   - The user can download the individual artifacts (CSV, PNG, PDF, HTML Profiling Report) or a ZIP archive containing everything.
   - The user can trigger an email delivery via the `EmailModal.tsx` component. This serves as a strict "Review & Send" approval flow: the user previews the generated PDF in the modal before explicitly clicking Send. The modal sends a request to `/api/job/:jobId/email`. The backend uses the Gmail API (via provided OAuth tokens) to securely dispatch the package.

## Features in Detail

* **Real-time Log Viewer:** A sliding terminal window at the bottom of the screen displays real-time SSE logs from the backend processing pipeline.
* **Graceful Error Handling:** If the pipeline fails at the AI generation stage (e.g., rate limits), it safely falls back to a generic report. If it fails during email delivery, it pauses in a specific `delivery_error` state, allowing the user to retry without re-uploading the data.
* **Dark/Light Mode:** A robust theming system built on Tailwind's `dark:` classes, toggled via `ThemeToggle.tsx`.
* **Ambient Backgrounds:** Framer Motion is used to create a slow-moving, aesthetically pleasing background gradient (`AmbientBackground.tsx`).


## Security & Reliability
- **Strict Session Isolation:** All API endpoints (`/download/pdf`, `/chat`, `/export-docs`, `/email`) strictly require a unique `jobToken` generated upon upload, preventing unauthorized cross-session access to data.
- **Safe Data Cleaning:** The system uses strict JSON-based operations for data cleaning (handled natively in TypeScript via `applyCleaningPlan()`), completely avoiding dangerous `eval()` or code-execution pathways.

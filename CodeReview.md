# Kriton Analytics - Code Review & Technical Documentation

This document provides an in-depth code review of the Kriton Analytics application, breaking down the purpose and functionality of the core files and functions.

## 1. Backend Architecture (`server.ts`)

The Express server (`server.ts`) acts as the orchestrator for the entire application. It serves the Vite-built React frontend in production, provides the API endpoints, and runs the heavy data processing pipeline.

### Core Dependencies & Setup
* `express`: The core web server framework.
* `multer`: Middleware for handling `multipart/form-data` (file uploads).
* `@google/genai`: The official Gemini API SDK for AI generation tasks.
* `pdfkit`: Used for server-side PDF generation.
* `events`: Native Node.js module used to manage SSE (Server-Sent Events) clients.
* `papaparse`: Powerful CSV parsing and unparsing library.

### Key API Endpoints
* `POST /api/upload`: Handled by multer. It receives the uploaded CSV, generates a unique `jobId`, creates a new `PipelineJob` object in the in-memory `jobs` Map, and returns the `jobId` to the client.
* `GET /api/job/:jobId/stream`: Establishes the Server-Sent Events (SSE) connection. This allows the server to push real-time updates (status changes, logs, and dashboard specs) to the React client.
* `POST /api/job/:jobId/dashboard-image`: The React frontend captures a screenshot of the Recharts dashboard and POSTs the base64 image here. The server waits for this image to compile the final PDF report.
* `GET /api/job/:jobId/download/:fileType`: A dynamic endpoint that serves the generated artifacts (`csv`, `png`, `pdf`, `html` profiling report, or a combined `zip` archive using `archiver`).
* `POST /api/job/:jobId/email`: Triggers the final email delivery process via the Gmail API.

### The Pipeline Orchestration (`runPipeline` function)
The `runPipeline` function is the heart of the backend. It executes asynchronously in the background.
1. **Cleaning:** It parses the CSV, computes basic metrics, and calls `ai.models.generateContent` with a structured prompt asking Gemini for a cleaning strategy (outliers, formatting, null handling).
2. **Dashboard Planning:** It sends the cleaned data schema to Gemini, requesting a JSON configuration for a dashboard (`DashboardSpec`), including KPIs and chart definitions.
3. **Synchronization:** It sends the `spec` to the client via SSE. The client renders it and sends back the image.
4. **Narrative Generation:** Concurrently, the backend asks Gemini to write a Markdown-formatted executive summary based on the data trends.
5. **PDF Generation:** Once the AI text and client-side image are ready, `generateReportPdf()` (imported from `src/utils/pdf-generator.ts`) stitches them together into a final PDF buffer.

## 2. Frontend Application (`src/App.tsx`)

`App.tsx` is the primary React component. It manages the global state of the pipeline and orchestrates the transition between the upload screen, the processing phase, and the final results view.

### State Management
* `jobId`: Tracks the active pipeline session.
* `jobStatus`: Tracks the pipeline progress (`pending`, `cleaning`, `planning`, `complete`, `error`, `delivery_error`, etc.).
* `dashboardSpec` & `cleanedData`: Stores the JSON dashboard spec and the cleaned data array received from the server to pass down to the `DashboardView`.
* `logs`: An array of text logs pushed by the server, displayed in the `LogViewer`.

### Lifecycle Hooks
* `useEffect` (SSE Connection): When a `jobId` is present, it opens an `EventSource` connection to `/api/job/:jobId/stream`. It listens for `status`, `log`, `spec`, and `error` events, updating the React state accordingly. This creates the highly responsive real-time feedback loop seen in the UI.

## 3. UI Components (`src/components/`)

### `UploadForm.tsx`
Handles the initial file drag-and-drop or selection. Uses Framer Motion for interactive hover states and validates the file size and type before POSTing it to `/api/upload`.

### `DashboardView.tsx`
This is a highly dynamic component. It receives the `DashboardSpec` (from Gemini) and the raw data.
* It dynamically maps over the specification to render KPI cards and Charts (`recharts`).
* It automatically calculates the actual mathematical values for the KPIs (sum, average, count) based on the raw data.
* **Crucial Function:** The `captureDashboard` function uses `html-to-image` to take a snapshot of the DOM element containing the dashboard and POSTs it back to the server.

### `EmailModal.tsx`
A modal interface that allows the user to review the generated artifacts and input recipient details (`To`, `CC`, `BCC`, `Subject`, `Body`). It handles the API call to `/api/job/:jobId/email` and manages the `sending`, `success`, and `error` visual states for the delivery phase.

### `LogViewer.tsx`
A terminal-like window that displays the real-time SSE logs. It utilizes a `useRef` and `useEffect` hook to automatically scroll to the bottom whenever a new log is added to the array.

## 4. Shared Types (`src/types.ts`)
This file defines the TypeScript interfaces used across both the frontend and backend to ensure type safety.
* `PipelineJob`: The core state machine object stored in the server's memory.
* `DashboardSpec`: Defines the structure of the JSON object that Gemini must return to describe the dashboard layouts, KPIs, and Charts.

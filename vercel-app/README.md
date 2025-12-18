# Google Form Exam Grader

A Next.js web application that grades Google Form exam responses and organizes results by student groups.

## Features

- **Google Sheets Auto-Sync**: Automatic webhook integration - data syncs when your sheet updates
- **CSV Upload**: Traditional file upload support
- **Auto Program Detection**: Automatically clusters submissions by date into programs
- **Group Management**: Organize students into groups and private sessions
- **Fuzzy Name Matching**: Handles variations in student name formatting
- **Answer Key Detection**: Automatically finds the answer key row
- **Export Results**: Download results as a text file

## Quick Start

### 1. Install Dependencies

```bash
cd vercel-app
npm install
```

### 2. Set Up Google Sheets Webhook (Optional)

If you want to use Google Sheets auto-sync, follow the [SETUP.md](SETUP.md) guide to:
- Deploy your app to Vercel
- Add a Google Apps Script to your Google Sheet
- Configure the webhook to send data automatically

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## How to Use

### Option A: Load from Google Sheets (Recommended)

1. Set up the Google Apps Script webhook (see [SETUP.md](SETUP.md))
2. Deploy your app to Vercel
3. The script automatically sends data when your sheet is edited
4. Click "Load Latest Data from Google Sheets" to fetch the most recent data

**Benefits:**
- No manual CSV downloads needed
- Data syncs automatically when sheet is edited or form responses come in
- No API keys or credentials needed
- Just click the button to load the latest data

### Option B: Upload CSV File

1. Download your Google Form responses as CSV
2. Click "Choose File" and select your CSV
3. The app will process it immediately

### Grading Exams

1. Load your data (via Google Sheets or CSV)
2. The app will auto-detect programs based on submission dates
3. (Optional) Filter by a specific program
4. Add groups and assign students to organize results
5. Click "Grade Exams" to see results
6. Export results to save as a text file

## Answer Key Format

The CSV/Sheet must contain an answer key row where the name field includes:
- "testing", "answer", or "key"

Example: A student named "Testing Answer Key" or just "testing"

## Data Format

Your CSV/Google Sheet should have:
- A name column (containing student names)
- A timestamp column (for program detection)
- Question columns (one per question)

## Deployment

### Deploy to Vercel

```bash
npm run build
vercel deploy
```

No environment variables needed! The webhook approach doesn't require API credentials.

See [SETUP.md](SETUP.md) for webhook setup details.

## Project Structure

```
vercel-app/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts       # Webhook endpoint for Google Sheets
│   ├── layout.tsx
│   └── page.tsx               # Main application
├── public/
├── google-apps-script.js      # Script to paste in Google Sheets
├── SETUP.md                   # Webhook setup guide
└── README.md                  # This file
```

## Environment Variables

No environment variables required! The webhook approach uses Google Apps Script directly from your Google Sheet, so no API credentials are needed.

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling
- **Google Apps Script**: Webhook-based data sync
- **Vercel**: Deployment platform

## Contributing

Feel free to submit issues and pull requests!

## License

MIT

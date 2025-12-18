# Google Sheets Webhook Setup Guide

This guide will help you set up automatic syncing between your Google Sheet and your Vercel app using Google Apps Script webhooks.

## Overview

When you edit your Google Sheet (or when new form responses are added), a script will automatically send the updated data to your Vercel app. No API keys or credentials needed!

## Step-by-Step Setup

### Step 1: Deploy Your Vercel App

1. Make sure your app is deployed to Vercel
2. Get your app URL (e.g., `https://your-app.vercel.app`)
3. Keep this URL handy - you'll need it in Step 3

### Step 2: Open Google Apps Script

1. Open your Google Sheet (the one connected to your Google Form)
2. Click **Extensions** → **Apps Script**
3. You'll see a new browser tab with the Apps Script editor

### Step 3: Add the Webhook Script

1. In the Apps Script editor, **delete any existing code**
2. Open the file [`google-apps-script.js`](google-apps-script.js) from this project
3. **Copy all the code** from that file
4. **Paste it** into the Apps Script editor
5. Find this line near the top:
   ```javascript
   const VERCEL_APP_URL = 'YOUR_VERCEL_APP_URL';
   ```
6. **Replace** `YOUR_VERCEL_APP_URL` with your actual Vercel URL:
   ```javascript
   const VERCEL_APP_URL = 'https://your-app.vercel.app';
   ```
   ⚠️ **Important:** No trailing slash!

### Step 4: Save and Name Your Project

1. Click the **floppy disk icon** (💾) or press `Ctrl+S` to save
2. Give your project a name (e.g., "Form Grader Auto-Sync")
3. Click **OK**

### Step 5: Run the Setup Function

1. In the Apps Script editor, find the function dropdown (shows "Select function")
2. Select **`setup`** from the dropdown
3. Click the **Run** button (▶️)
4. You'll be asked to authorize the script:
   - Click **Review permissions**
   - Select your Google account
   - Click **Advanced** → **Go to [Your Project Name] (unsafe)**
   - Click **Allow**

5. Wait for the script to finish (you'll see "Execution completed" at the bottom)
6. Check the **Execution log** - you should see success messages

### Step 6: Test the Connection

1. In the Apps Script editor, select **`testWebhook`** from the function dropdown
2. Click **Run** (▶️)
3. Check the execution log for success messages
4. Go to your Vercel app in your browser
5. Click **"Load Latest Data from Google Sheets"**
6. You should see your sheet data loaded!

## How It Works

### Automatic Updates

Once set up, the script will automatically send data to your app when:
- You manually edit any cell in the sheet
- New form responses are added (via Google Forms)
- Rows are added, deleted, or modified

### Loading Data in Your App

1. Open your Vercel app
2. Click **"Load Latest Data from Google Sheets"**
3. The app fetches the most recent data that was sent by the script
4. You'll see a timestamp showing when the data was last updated

### How the Data Flows

```
Google Sheet
    ↓
  (edited)
    ↓
Google Apps Script Trigger
    ↓
  (sends data)
    ↓
Your Vercel App Webhook (/api/webhook)
    ↓
  (stores in memory)
    ↓
Frontend loads data when you click the button
```

## Troubleshooting

### "No data available yet"

**Problem:** App says "No data available yet. Please update your Google Sheet..."

**Solutions:**
1. Make sure you ran the `setup` function in Apps Script
2. Try running `testWebhook` manually in Apps Script
3. Check the Apps Script execution log for errors
4. Make sure `VERCEL_APP_URL` is correct (no trailing slash!)

### Data Not Updating

**Problem:** Made changes to the sheet but app shows old data

**Solutions:**
1. Check if triggers are installed: Run `getInfo()` in Apps Script to see active triggers
2. Look at the Apps Script execution log for recent runs
3. Try editing the sheet again - sometimes it takes a few seconds
4. Manually run `testWebhook()` to force a sync

### "Sync failed" in Apps Script Logs

**Problem:** Apps Script log shows "❌ Sync failed with status XXX"

**Solutions:**
1. Verify your Vercel app is deployed and accessible
2. Check that the webhook URL is correct: `https://your-app.vercel.app/api/webhook`
3. Make sure there are no typos in `VERCEL_APP_URL`
4. Test the webhook URL in your browser (you should see an error about POST method, which is normal)

### Authorization Issues

**Problem:** Script asks for permissions again or shows errors

**Solutions:**
1. Re-run the `setup` function
2. Remove and recreate triggers: Run `removeTriggers()` then `setup()` again
3. Check that your Google account has edit access to the sheet

## Advanced Configuration

### Debug Mode

To see detailed logs in Apps Script:

```javascript
const DEBUG_MODE = true;  // Change to false to reduce logging
```

### Viewing Triggers

To see what triggers are installed:

1. In Apps Script editor, select `getInfo` from the function dropdown
2. Click Run
3. Check the execution log for trigger information

### Removing Triggers

If you need to disable auto-sync:

1. Select `removeTriggers` from the function dropdown
2. Click Run
3. This removes all triggers - the script won't run automatically anymore

To re-enable, just run `setup` again.

## Important Notes

### Data Storage

- Data is stored **in memory** on your Vercel server
- When Vercel restarts your app, the data persists during the session
- For production use with high traffic, consider using a database (Redis, Vercel KV, etc.)

### Rate Limits

- Google Apps Script has rate limits (~20 trigger executions per hour per user)
- If you edit the sheet very frequently, some updates might be batched or delayed
- This is usually fine for form responses which come in gradually

### Security

- The webhook endpoint is **public** - anyone with the URL can send data
- For production, consider adding authentication (API key, secret token, etc.)
- The current setup is fine for testing and low-security use cases

### Vercel Serverless Functions

- The webhook runs as a Vercel serverless function
- Data persists in memory during the function's lifecycle
- For long-term storage, integrate a database

## Testing Your Setup

### Quick Test Checklist

- [ ] Deployed Vercel app and got the URL
- [ ] Opened Google Sheet → Extensions → Apps Script
- [ ] Pasted the script code
- [ ] Set `VERCEL_APP_URL` to your actual URL
- [ ] Saved the project
- [ ] Ran the `setup` function
- [ ] Authorized the script
- [ ] Ran `testWebhook` function
- [ ] Opened your app and clicked "Load Latest Data"
- [ ] Saw your sheet data in the app
- [ ] Made a test edit to the sheet
- [ ] Clicked "Load Latest Data" again and saw the update

If all checkboxes are complete, you're all set! 🎉

## Need Help?

- Check the Apps Script **Execution log** (bottom of the editor) for errors
- Run `getInfo()` to see your current setup details
- Run `testWebhook()` to manually test the connection
- Make sure your Vercel app is deployed and accessible
- Verify the webhook URL format: `https://your-app.vercel.app/api/webhook`

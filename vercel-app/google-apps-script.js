/**
 * Google Apps Script for Auto-Syncing Google Sheets to Vercel App
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet (the one with your form responses)
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Replace YOUR_VERCEL_APP_URL with your actual Vercel URL
 * 6. Click the floppy disk icon to save
 * 7. Give your project a name (e.g., "Form Grader Sync")
 * 8. Run the "setup" function once (click Run button)
 * 9. Authorize the script when prompted
 *
 * After setup, the script will automatically send data to your app
 * whenever the sheet is edited!
 */

// ========================================
// CONFIGURATION - EDIT THIS!
// ========================================

// Replace this with your Vercel app URL (no trailing slash)
const VERCEL_APP_URL = 'YOUR_VERCEL_APP_URL';  // e.g., 'https://your-app.vercel.app'

// Optional: Set to true to see detailed logs in Apps Script console
const DEBUG_MODE = true;

// ========================================
// MAIN FUNCTIONS
// ========================================

/**
 * Triggered automatically when the sheet is edited
 */
function onEdit(e) {
  if (DEBUG_MODE) {
    console.log('Sheet edited, syncing data...');
  }

  syncDataToWebhook();
}

/**
 * Triggered automatically when the sheet structure changes
 * (e.g., rows added via form submission)
 */
function onChange(e) {
  if (DEBUG_MODE) {
    console.log('Sheet changed, syncing data...');
  }

  syncDataToWebhook();
}

/**
 * Manual function to test the webhook
 * Click Run → testWebhook to test manually
 */
function testWebhook() {
  console.log('Testing webhook manually...');
  syncDataToWebhook();
  console.log('Test complete! Check your app to see if data loaded.');
}

/**
 * Setup function - run this once after pasting the script
 */
function setup() {
  // Install triggers
  const sheet = SpreadsheetApp.getActiveSpreadsheet();

  // Remove existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // Create new triggers
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(sheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(sheet)
    .onChange()
    .create();

  console.log('✅ Triggers installed successfully!');
  console.log('The sheet will now automatically sync to your app when edited.');

  // Send initial data
  syncDataToWebhook();
  console.log('✅ Initial data sync complete!');
}

// ========================================
// CORE SYNC LOGIC
// ========================================

/**
 * Sends the sheet data to the webhook endpoint
 */
function syncDataToWebhook() {
  try {
    // Validate configuration
    if (VERCEL_APP_URL === 'YOUR_VERCEL_APP_URL') {
      throw new Error('Please set VERCEL_APP_URL in the script configuration!');
    }

    // Get the active sheet
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();

    if (DEBUG_MODE) {
      console.log(`Syncing sheet: ${sheetName}`);
    }

    // Get all data from the sheet
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();

    if (data.length === 0) {
      console.log('Sheet is empty, nothing to sync');
      return;
    }

    // Prepare the payload
    const payload = {
      data: data,
      sheetName: sheetName,
      timestamp: new Date().toISOString(),
      rowCount: data.length - 1  // Exclude header row
    };

    // Send to webhook
    const webhookUrl = `${VERCEL_APP_URL}/api/webhook`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true  // Don't throw on HTTP errors
    };

    if (DEBUG_MODE) {
      console.log(`Sending ${payload.rowCount} rows to ${webhookUrl}`);
    }

    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      console.log(`✅ Sync successful! ${payload.rowCount} rows sent.`);
      if (DEBUG_MODE) {
        console.log('Response:', responseText);
      }
    } else {
      console.error(`❌ Sync failed with status ${responseCode}`);
      console.error('Response:', responseText);
    }

  } catch (error) {
    console.error('❌ Error syncing data:', error.toString());
    console.error('Stack:', error.stack);
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Remove all triggers (useful for debugging)
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  console.log(`Removed ${triggers.length} trigger(s)`);
}

/**
 * Get info about the current setup
 */
function getInfo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getProjectTriggers();

  console.log('=== SETUP INFO ===');
  console.log(`Spreadsheet: ${sheet.getName()}`);
  console.log(`Sheet ID: ${sheet.getId()}`);
  console.log(`Webhook URL: ${VERCEL_APP_URL}/api/webhook`);
  console.log(`Active Triggers: ${triggers.length}`);
  console.log(`Debug Mode: ${DEBUG_MODE ? 'ON' : 'OFF'}`);

  triggers.forEach((trigger, index) => {
    console.log(`  Trigger ${index + 1}: ${trigger.getHandlerFunction()} (${trigger.getEventType()})`);
  });
}

// ========================================
// NOTES FOR DEVELOPERS
// ========================================

/*
 * TRIGGER TYPES:
 * - onEdit: Fires when a user manually edits a cell
 * - onChange: Fires when the sheet structure changes (rows added, deleted, etc.)
 *   This is crucial for form responses which add rows automatically!
 *
 * DEBUGGING:
 * - View logs: Apps Script editor → Execution log (at bottom)
 * - Run testWebhook() manually to test without editing the sheet
 * - Set DEBUG_MODE = true for detailed logging
 *
 * LIMITATIONS:
 * - Triggers have a rate limit (typically 20 executions per user per hour)
 * - If you edit the sheet rapidly, some updates might be skipped
 * - The script runs on Google's servers, not in real-time
 *
 * TROUBLESHOOTING:
 * - If not working, run getInfo() to check setup
 * - Make sure VERCEL_APP_URL is correct (no trailing slash!)
 * - Check execution logs for error messages
 * - Try running testWebhook() manually
 * - Verify your Vercel app is deployed and accessible
 */

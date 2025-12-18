import { NextRequest, NextResponse } from 'next/server'

// Store the latest sheet data in memory (persists during server runtime)
// For production, consider using a database or cache like Redis/Vercel KV
let latestSheetData: {
  headers: string[]
  data: any[]
  timestamp: number
} | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the incoming data
    if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    // Extract headers and data rows
    const headers = body.data[0]
    const dataRows = body.data.slice(1)

    // Convert to the format expected by the frontend
    const formattedData = dataRows.map((row: any[]) => {
      const obj: any = {}
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || ''
      })
      return obj
    })

    // Store the data with timestamp
    latestSheetData = {
      headers,
      data: formattedData,
      timestamp: Date.now()
    }

    console.log(`Webhook received: ${dataRows.length} rows updated at ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Data received and stored',
      rowCount: dataRows.length
    })

  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook data' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!latestSheetData) {
      return NextResponse.json(
        { error: 'No data available yet. Please update your Google Sheet to trigger the webhook.' },
        { status: 404 }
      )
    }

    // Check if data is older than 24 hours
    const hoursSinceUpdate = (Date.now() - latestSheetData.timestamp) / (1000 * 60 * 60)

    return NextResponse.json({
      headers: latestSheetData.headers,
      data: latestSheetData.data,
      rowCount: latestSheetData.data.length,
      lastUpdated: new Date(latestSheetData.timestamp).toISOString(),
      hoursOld: Math.round(hoursSinceUpdate * 10) / 10
    })

  } catch (error: any) {
    console.error('GET Webhook Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

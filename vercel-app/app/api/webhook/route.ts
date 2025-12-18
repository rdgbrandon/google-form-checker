import { NextRequest, NextResponse } from 'next/server'

// Store multiple sheets in memory (persists during server runtime)
// For production, consider using a database or cache like Redis/Vercel KV
let sheetDataStore: Map<string, {
  headers: string[]
  data: any[]
  timestamp: number
}> = new Map()

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

    // Get sheet name (defaults to 'default' if not provided)
    const sheetName = body.sheetName || 'default'

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
    sheetDataStore.set(sheetName, {
      headers,
      data: formattedData,
      timestamp: Date.now()
    })

    console.log(`Webhook received for "${sheetName}": ${dataRows.length} rows updated at ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Data received and stored',
      sheetName,
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
    const { searchParams } = new URL(request.url)
    const sheetName = searchParams.get('sheet')

    // If sheet name provided, return that specific sheet
    if (sheetName) {
      const sheetData = sheetDataStore.get(sheetName)

      if (!sheetData) {
        return NextResponse.json(
          { error: `Sheet "${sheetName}" not found. Please update your Google Sheet to trigger the webhook.` },
          { status: 404 }
        )
      }

      const hoursSinceUpdate = (Date.now() - sheetData.timestamp) / (1000 * 60 * 60)

      return NextResponse.json({
        headers: sheetData.headers,
        data: sheetData.data,
        rowCount: sheetData.data.length,
        lastUpdated: new Date(sheetData.timestamp).toISOString(),
        hoursOld: Math.round(hoursSinceUpdate * 10) / 10,
        sheetName
      })
    }

    // No sheet name provided - return list of available sheets or the most recent
    if (sheetDataStore.size === 0) {
      return NextResponse.json(
        { error: 'No data available yet. Please update your Google Sheet to trigger the webhook.' },
        { status: 404 }
      )
    }

    // Return list of available sheets
    const sheets = Array.from(sheetDataStore.entries()).map(([name, data]) => ({
      name,
      rowCount: data.data.length,
      lastUpdated: new Date(data.timestamp).toISOString()
    }))

    // Also return the most recent sheet's data
    const mostRecent = Array.from(sheetDataStore.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)[0]

    const [mostRecentName, mostRecentData] = mostRecent
    const hoursSinceUpdate = (Date.now() - mostRecentData.timestamp) / (1000 * 60 * 60)

    return NextResponse.json({
      headers: mostRecentData.headers,
      data: mostRecentData.data,
      rowCount: mostRecentData.data.length,
      lastUpdated: new Date(mostRecentData.timestamp).toISOString(),
      hoursOld: Math.round(hoursSinceUpdate * 10) / 10,
      sheetName: mostRecentName,
      availableSheets: sheets
    })

  } catch (error: any) {
    console.error('GET Webhook Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

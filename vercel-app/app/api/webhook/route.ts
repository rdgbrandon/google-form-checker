import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@vercel/kv'

// Create KV client using REDIS_URL environment variable
const kv = createClient({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_URL!, // For Vercel Redis, the URL contains auth
})

// KV store keys
const SHEETS_INDEX_KEY = 'sheets:index' // List of all sheet names
const getSheetKey = (name: string) => `sheet:${name}` // Individual sheet data

interface SheetData {
  headers: string[]
  data: any[]
  timestamp: number
}

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

    // Store the data with timestamp in Vercel KV
    const sheetData: SheetData = {
      headers,
      data: formattedData,
      timestamp: Date.now()
    }

    await kv.set(getSheetKey(sheetName), sheetData)

    // Update the sheets index
    const existingSheets = await kv.get<string[]>(SHEETS_INDEX_KEY) || []
    if (!existingSheets.includes(sheetName)) {
      await kv.set(SHEETS_INDEX_KEY, [...existingSheets, sheetName])
    }

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
      const sheetData = await kv.get<SheetData>(getSheetKey(sheetName))

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
    const sheetNames = await kv.get<string[]>(SHEETS_INDEX_KEY)

    if (!sheetNames || sheetNames.length === 0) {
      return NextResponse.json(
        { error: 'No data available yet. Please update your Google Sheet to trigger the webhook.' },
        { status: 404 }
      )
    }

    // Get all sheet data
    const sheetsData = await Promise.all(
      sheetNames.map(async (name) => {
        const data = await kv.get<SheetData>(getSheetKey(name))
        return { name, data }
      })
    )

    // Filter out any null results and create sheets list
    const validSheets = sheetsData.filter(s => s.data !== null) as { name: string, data: SheetData }[]

    if (validSheets.length === 0) {
      return NextResponse.json(
        { error: 'No data available yet. Please update your Google Sheet to trigger the webhook.' },
        { status: 404 }
      )
    }

    const sheets = validSheets.map(({ name, data }) => ({
      name,
      rowCount: data.data.length,
      lastUpdated: new Date(data.timestamp).toISOString()
    }))

    // Also return the most recent sheet's data
    const mostRecent = validSheets.sort((a, b) => b.data.timestamp - a.data.timestamp)[0]
    const hoursSinceUpdate = (Date.now() - mostRecent.data.timestamp) / (1000 * 60 * 60)

    return NextResponse.json({
      headers: mostRecent.data.headers,
      data: mostRecent.data.data,
      rowCount: mostRecent.data.data.length,
      lastUpdated: new Date(mostRecent.data.timestamp).toISOString(),
      hoursOld: Math.round(hoursSinceUpdate * 10) / 10,
      sheetName: mostRecent.name,
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

import { NextRequest, NextResponse } from 'next/server'

// Store groups in memory (persists during server runtime)
// For production, consider using a database or cache like Redis/Vercel KV
let storedGroups: Array<{
  name: string
  students: string[]
}> = [{ name: 'Group 1', students: [] }]

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      groups: storedGroups
    })
  } catch (error: any) {
    console.error('GET Groups Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the incoming data
    if (!body.groups || !Array.isArray(body.groups)) {
      return NextResponse.json(
        { error: 'Invalid groups format' },
        { status: 400 }
      )
    }

    // Update the stored groups
    storedGroups = body.groups

    console.log(`Groups updated: ${storedGroups.length} groups saved at ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Groups saved successfully',
      groupCount: storedGroups.length
    })

  } catch (error: any) {
    console.error('POST Groups Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save groups' },
      { status: 500 }
    )
  }
}

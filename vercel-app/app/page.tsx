'use client'

import { useState, useCallback } from 'react'

interface Group {
  name: string
  students: string[]
}

interface StudentResult {
  name: string
  group: string
  missed: number[]
  score: string
}

interface ProcessedResults {
  results: StudentResult[]
  totalStudents: number
  questionCount: number
  programs: string[]
}

export default function Home() {
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [groups, setGroups] = useState<Group[]>([
    { name: 'Group 1', students: [] },
  ])
  const [results, setResults] = useState<ProcessedResults | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newStudentName, setNewStudentName] = useState<{ [key: number]: string }>({})
  const [selectedProgram, setSelectedProgram] = useState<string>('all')
  const [detectedPrograms, setDetectedPrograms] = useState<string[]>([])
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [availableSheets, setAvailableSheets] = useState<any[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [currentSheetName, setCurrentSheetName] = useState<string>('')

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
          setError('CSV file must have at least a header row and one data row')
          return
        }

        // Parse CSV properly handling quoted fields
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = []
          let current = ''
          let inQuotes = false

          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result
        }

        const headers = parseCSVLine(lines[0])
        setCsvHeaders(headers)

        const data = lines.slice(1).map(line => {
          const values = parseCSVLine(line)
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          return row
        })

        setCsvData(data)

        // Detect programs based on timestamps
        const programs = detectPrograms(data, headers)
        setDetectedPrograms(programs)

        setResults(null)
      } catch (err) {
        setError('Error parsing CSV file: ' + (err as Error).message)
      }
    }

    reader.onerror = () => {
      setError('Error reading file')
    }

    reader.readAsText(file)
  }, [])

  const loadFromWebhook = async (sheetName?: string) => {
    setIsLoadingWebhook(true)
    setError(null)

    try {
      const url = sheetName ? `/api/webhook?sheet=${encodeURIComponent(sheetName)}` : '/api/webhook'
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch data from webhook')
      }

      const { headers, data, lastUpdated: timestamp, sheetName: returnedSheetName, availableSheets } = await response.json()

      setCsvHeaders(headers)
      setCsvData(data)
      setLastUpdated(timestamp)
      setCurrentSheetName(returnedSheetName || '')

      if (availableSheets) {
        setAvailableSheets(availableSheets)
      }

      // Detect programs based on timestamps
      const programs = detectPrograms(data, headers)
      setDetectedPrograms(programs)

      setResults(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load data from webhook')
    } finally {
      setIsLoadingWebhook(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here if desired
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  const detectPrograms = (data: any[], headers: string[]): string[] => {
    const timestampField = headers.find(h =>
      h.toLowerCase().includes('timestamp') ||
      h.toLowerCase().includes('time') ||
      h.toLowerCase().includes('date')
    )

    if (!timestampField) return ['All Submissions']

    const timestamps: Date[] = []
    data.forEach(row => {
      const ts = row[timestampField]
      if (ts) {
        const parsed = new Date(ts)
        if (!isNaN(parsed.getTime())) {
          timestamps.push(parsed)
        }
      }
    })

    if (timestamps.length === 0) return ['All Submissions']

    timestamps.sort((a, b) => a.getTime() - b.getTime())

    // Cluster by 2-week gaps
    const clusters: Date[][] = [[timestamps[0]]]
    const twoWeeks = 14 * 24 * 60 * 60 * 1000

    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i].getTime() - timestamps[i - 1].getTime()
      if (gap > twoWeeks) {
        clusters.push([timestamps[i]])
      } else {
        clusters[clusters.length - 1].push(timestamps[i])
      }
    }

    return clusters.map(cluster => {
      const first = cluster[0]
      const last = cluster[cluster.length - 1]
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
        return `${months[first.getMonth()]} ${first.getFullYear()}`
      } else {
        return `${months[first.getMonth()]}-${months[last.getMonth()]} ${last.getFullYear()}`
      }
    })
  }

  const addGroup = () => {
    const groupNumbers = groups
      .map(g => {
        const match = g.name.match(/Group (\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      .filter(n => n > 0)

    const nextNumber = groupNumbers.length > 0 ? Math.max(...groupNumbers) + 1 : 1
    setGroups([...groups, { name: `Group ${nextNumber}`, students: [] }])
  }

  const addPrivateGroup = () => {
    const privateNumbers = groups
      .map(g => {
        const match = g.name.match(/PRIVATE (\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      .filter(n => n > 0)

    const nextNumber = privateNumbers.length > 0 ? Math.max(...privateNumbers) + 1 : 1
    setGroups([...groups, { name: `PRIVATE ${nextNumber}`, students: [] }])
  }

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index))
  }

  const updateGroupName = (index: number, name: string) => {
    const updated = [...groups]
    updated[index].name = name
    setGroups(updated)
  }

  const addStudentToGroup = (groupIndex: number) => {
    const name = newStudentName[groupIndex]?.trim()
    if (!name) return

    const updated = [...groups]
    if (!updated[groupIndex].students.includes(name)) {
      updated[groupIndex].students.push(name)
      setGroups(updated)
    }
    setNewStudentName({ ...newStudentName, [groupIndex]: '' })
  }

  const removeStudentFromGroup = (groupIndex: number, studentIndex: number) => {
    const updated = [...groups]
    updated[groupIndex].students.splice(studentIndex, 1)
    setGroups(updated)
  }

  const processResults = () => {
    if (csvData.length === 0) {
      setError('Please upload a CSV file first')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Find name column
      const nameField = csvHeaders.find(h =>
        h.toLowerCase().includes('name') ||
        h.toLowerCase().includes('first') ||
        h.toLowerCase().includes('last')
      )

      if (!nameField) {
        throw new Error('Could not find a name column in the CSV')
      }

      // Find timestamp column for program filtering
      const timestampField = csvHeaders.find(h =>
        h.toLowerCase().includes('timestamp') ||
        h.toLowerCase().includes('time') ||
        h.toLowerCase().includes('date')
      )

      // Find question columns
      const questionColumns = csvHeaders.filter(h =>
        h.toLowerCase().includes('question') ||
        h.toLowerCase().includes('q ') ||
        h.toLowerCase().includes('q.') ||
        (h.match(/^\d+$/) || h.match(/^q\d+$/i))
      )

      if (questionColumns.length === 0) {
        // Try to find any columns that might be questions (not name, timestamp, email, score)
        const excludePatterns = ['name', 'email', 'timestamp', 'time', 'date', 'score']
        const potentialQuestions = csvHeaders.filter(h =>
          !excludePatterns.some(p => h.toLowerCase().includes(p))
        )
        questionColumns.push(...potentialQuestions)
      }

      // Find answer key
      let answerKey: any = null
      for (const row of csvData) {
        const name = (row[nameField] || '').toLowerCase()
        if (name.includes('testing') || name.includes('answer') || name.includes('key')) {
          answerKey = row
          break
        }
      }

      if (!answerKey) {
        throw new Error('Could not find answer key row (should contain "testing", "answer", or "key" in the name)')
      }

      // Normalize name function
      const normalizeName = (name: string): string => {
        return name.toLowerCase().replace(/[,\s]+/g, ' ').trim()
      }

      // Fuzzy name matching
      const namesMatch = (name1: string, name2: string): boolean => {
        const n1 = normalizeName(name1)
        const n2 = normalizeName(name2)

        if (n1 === n2) return true

        // Check reversed order
        const parts1 = n1.split(' ')
        const parts2 = n2.split(' ')

        if (parts1.length >= 2 && parts2.length >= 2) {
          const reversed1 = [...parts1].reverse().join(' ')
          if (reversed1 === n2) return true
        }

        // Simple similarity check
        const longer = n1.length > n2.length ? n1 : n2
        const shorter = n1.length > n2.length ? n2 : n1

        if (longer.includes(shorter) && shorter.length > 3) return true

        return false
      }

      // Find student group
      const findStudentGroup = (studentName: string): string => {
        for (const group of groups) {
          for (const member of group.students) {
            if (namesMatch(studentName, member)) {
              return group.name
            }
          }
        }
        return 'Ungrouped'
      }

      // Filter by program if selected
      let filteredData = csvData.filter(row => {
        const name = (row[nameField] || '').toLowerCase()
        return !name.includes('testing') && !name.includes('answer') && !name.includes('key')
      })

      if (selectedProgram !== 'all' && timestampField) {
        filteredData = filteredData.filter(row => {
          const ts = row[timestampField]
          if (!ts) return false
          const parsed = new Date(ts)
          if (isNaN(parsed.getTime())) return false

          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthName = months[parsed.getMonth()]
          const year = parsed.getFullYear()

          return selectedProgram.includes(monthName) && selectedProgram.includes(year.toString())
        })
      }

      // Deduplicate by keeping latest submission
      const latestSubmissions = new Map<string, any>()

      filteredData.forEach(row => {
        const name = normalizeName(row[nameField] || '')
        if (!name) return

        const existing = latestSubmissions.get(name)
        if (!existing) {
          latestSubmissions.set(name, row)
        } else if (timestampField) {
          const existingTime = new Date(existing[timestampField]).getTime()
          const newTime = new Date(row[timestampField]).getTime()
          if (newTime > existingTime) {
            latestSubmissions.set(name, row)
          }
        }
      })

      // Grade each student
      const studentResults: StudentResult[] = []

      latestSubmissions.forEach((row, normalizedName) => {
        const originalName = row[nameField]
        const missed: number[] = []

        questionColumns.forEach((col, index) => {
          const studentAnswer = (row[col] || '').trim().toUpperCase()
          const correctAnswer = (answerKey[col] || '').trim().toUpperCase()

          if (studentAnswer !== correctAnswer) {
            missed.push(index + 1)
          }
        })

        const group = findStudentGroup(originalName)
        const score = `${questionColumns.length - missed.length}/${questionColumns.length}`

        studentResults.push({
          name: originalName,
          group,
          missed,
          score
        })
      })

      // Sort results by group
      studentResults.sort((a, b) => {
        const getGroupOrder = (name: string): number => {
          if (name.startsWith('Group')) {
            const num = parseInt(name.replace('Group ', '')) || 0
            return num
          } else if (name.startsWith('PRIVATE')) {
            const num = parseInt(name.replace('PRIVATE ', '')) || 0
            return 100 + num
          } else {
            return 1000
          }
        }

        const orderA = getGroupOrder(a.group)
        const orderB = getGroupOrder(b.group)

        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })

      setResults({
        results: studentResults,
        totalStudents: studentResults.length,
        questionCount: questionColumns.length,
        programs: detectedPrograms
      })

    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const exportResults = () => {
    if (!results) return

    let output = '=== EXAM RESULTS ===\n\n'
    output += `Total Students: ${results.totalStudents}\n`
    output += `Questions: ${results.questionCount}\n`
    if (selectedProgram !== 'all') {
      output += `Program: ${selectedProgram}\n`
    }
    output += '\n'

    // Group results by group
    const byGroup = new Map<string, StudentResult[]>()
    results.results.forEach(r => {
      const existing = byGroup.get(r.group) || []
      existing.push(r)
      byGroup.set(r.group, existing)
    })

    byGroup.forEach((students, group) => {
      output += `--- ${group} (${students.length} students) ---\n`
      students.forEach(s => {
        if (s.missed.length === 0) {
          output += `  ${s.name}: All correct!\n`
        } else {
          output += `  ${s.name}: ${s.missed.join(', ')}\n`
        }
      })
      output += '\n'
    })

    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'exam_results.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Google Form Exam Grader
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Data Source Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">1. Load Data</h2>

          {/* Google Sheets Webhook Option */}
          <div className="mb-6 p-4 border border-blue-200 rounded bg-blue-50">
            <h3 className="font-semibold mb-2 text-gray-700">Option A: Google Sheets (Auto-Sync)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Set up the Google Apps Script webhook (see instructions below), then click to load the latest data
            </p>

            {availableSheets.length > 1 && (
              <div className="mb-3">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Select Sheet:</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">Most Recent</option>
                  {availableSheets.map((sheet, i) => (
                    <option key={i} value={sheet.name}>
                      {sheet.name} ({sheet.rowCount} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => loadFromWebhook(selectedSheet || undefined)}
              disabled={isLoadingWebhook}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full"
            >
              {isLoadingWebhook ? 'Loading...' : 'Load Latest Data from Google Sheets'}
            </button>
            {lastUpdated && (
              <p className="text-xs text-gray-500 mt-2">
                {currentSheetName && <span className="font-semibold">{currentSheetName} - </span>}
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
            <details className="mt-3 text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold hover:text-gray-800">
                📋 How does this work?
              </summary>
              <p className="mt-2 ml-2">
                When you edit your Google Sheet, a script automatically sends the updated data to this app.
                Click the button above to load the most recent data. See SETUP.md for configuration instructions.
              </p>
            </details>
          </div>

          {/* CSV Upload Option */}
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-semibold mb-2 text-gray-700">Option B: Upload CSV File</h3>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {csvData.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-gray-700">
              <p className="font-semibold">Data loaded successfully!</p>
              <p>Rows: {csvData.length} | Columns: {csvHeaders.length}</p>
              {detectedPrograms.length > 0 && (
                <p>Detected programs: {detectedPrograms.join(', ')}</p>
              )}
            </div>
          )}
        </div>

        {/* Program Selection */}
        {detectedPrograms.length > 1 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">2. Select Program (Optional)</h2>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="block w-full p-2 border border-gray-300 rounded"
            >
              <option value="all">All Programs</option>
              {detectedPrograms.map((prog, i) => (
                <option key={i} value={prog}>{prog}</option>
              ))}
            </select>
          </div>
        )}

        {/* Group Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            {detectedPrograms.length > 1 ? '3' : '2'}. Manage Groups
          </h2>

          <div className="flex gap-2 mb-4">
            <button
              onClick={addGroup}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Group
            </button>
            <button
              onClick={addPrivateGroup}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Add Private Session
            </button>
          </div>

          <div className="space-y-4">
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="border border-gray-200 rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroupName(groupIndex, e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded font-semibold"
                  />
                  <button
                    onClick={() => removeGroup(groupIndex)}
                    className="text-red-500 hover:text-red-700 px-2"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Student name"
                    value={newStudentName[groupIndex] || ''}
                    onChange={(e) => setNewStudentName({ ...newStudentName, [groupIndex]: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addStudentToGroup(groupIndex)}
                    className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={() => addStudentToGroup(groupIndex)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  >
                    Add
                  </button>
                </div>

                {group.students.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {group.students.map((student, studentIndex) => (
                      <span
                        key={studentIndex}
                        className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-1"
                      >
                        {student}
                        <button
                          onClick={() => removeStudentFromGroup(groupIndex, studentIndex)}
                          className="text-red-500 hover:text-red-700 ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Process Button */}
        <div className="text-center mb-6">
          <button
            onClick={processResults}
            disabled={isProcessing || csvData.length === 0}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Grade Exams'}
          </button>
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Results</h2>
              <button
                onClick={exportResults}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Export Results
              </button>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              <p>Total Students: {results.totalStudents}</p>
              <p>Questions: {results.questionCount}</p>
            </div>

            {/* Group results by group */}
            {(() => {
              const byGroup = new Map<string, StudentResult[]>()
              results.results.forEach(r => {
                const existing = byGroup.get(r.group) || []
                existing.push(r)
                byGroup.set(r.group, existing)
              })

              return Array.from(byGroup.entries()).map(([group, students]) => (
                <div key={group} className="mb-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">
                    {group} ({students.length} students)
                  </h3>
                  <div className="space-y-1">
                    {students.map((student, i) => {
                      const resultText = student.missed.length === 0
                        ? `${student.name}: All correct!`
                        : `${student.name}: ${student.missed.join(', ')}`

                      return (
                        <div key={i} className="text-sm flex justify-between items-center py-1 gap-2 group">
                          <span className="font-medium flex-shrink-0">{student.name}:</span>
                          <span className={`flex-1 ${student.missed.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {student.missed.length === 0
                              ? `All correct!`
                              : student.missed.join(', ')
                            }
                          </span>
                          <button
                            onClick={() => copyToClipboard(resultText)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs flex-shrink-0"
                            title="Copy to clipboard"
                          >
                            Copy
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 text-sm text-gray-500">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Upload your Google Form responses CSV file</li>
            <li>The CSV must include an answer key row (name containing &quot;testing&quot;, &quot;answer&quot;, or &quot;key&quot;)</li>
            <li>Add groups and assign students to organize your results</li>
            <li>Click &quot;Grade Exams&quot; to see results organized by group</li>
            <li>Export results to save as a text file</li>
          </ol>
        </div>
      </div>
    </main>
  )
}

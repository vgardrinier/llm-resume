import { NextRequest, NextResponse } from 'next/server'
const pdf = require('pdf-parse')
import { normalizePdfText } from '@/lib/utils/normalizePdfText'
import { ParseResumeResponse, ParseResumeError } from '@/types/api'

// Maximum file size: 1MB
const MAX_FILE_SIZE = 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    // Validate file presence
    if (!file) {
      return NextResponse.json<ParseResumeError>(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ParseResumeError>(
        { error: 'File too large. Please use a PDF under 1MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json<ParseResumeError>(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      )
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json<ParseResumeError>(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      )
    }

    // Convert file to buffer for pdf-parse
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text from PDF
    const pdfData = await pdf(buffer)
    
    // Normalize the extracted text
    const normalizedText = normalizePdfText(pdfData.text)

    // Log metadata only (never log file contents)
    console.log(`PDF parsed successfully: ${pdfData.numpages} pages, ${file.size} bytes`)

    // Return successful response
    const response: ParseResumeResponse = {
      text: normalizedText,
      pageCount: pdfData.numpages,
      byteSize: file.size
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('PDF parsing error:', error)
    
    // Return user-friendly error message
    return NextResponse.json<ParseResumeError>(
      { 
        error: 'Failed to extract text from PDF. Please paste text manually.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

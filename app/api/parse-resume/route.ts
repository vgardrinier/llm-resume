import { NextRequest, NextResponse } from 'next/server'
import PDFParser from 'pdf2json'
import { normalizePdfText } from '@/lib/utils/normalizePdfText'
import { ParseResumeResponse, ParseResumeError } from '@/types/api'

// Force Node.js runtime for this API route
export const runtime = 'nodejs'

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

    // Convert file to buffer for pdf2json
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text from PDF using pdf2json
    const pdfParser = new PDFParser()
    
    const pdfData = await new Promise<any>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(`PDF parsing error: ${errData.parserError}`))
      })
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        resolve(pdfData)
      })
      
      pdfParser.parseBuffer(buffer)
    })
    
    // Extract text from pdf2json output
    let extractedText = ''
    if (pdfData.Pages) {
      for (const page of pdfData.Pages) {
        if (page.Texts) {
          for (const text of page.Texts) {
            if (text.R) {
              for (const run of text.R) {
                if (run.T) {
                  extractedText += decodeURIComponent(run.T) + ' '
                }
              }
            }
          }
        }
        extractedText += '\n'
      }
    }
    
    // Normalize the extracted text
    const normalizedText = normalizePdfText(extractedText)
    
    console.log(`Extracted text length: ${extractedText.length}, Normalized length: ${normalizedText.length}`)

    // Log metadata only (never log file contents)
    console.log(`PDF parsed successfully: ${pdfData.Pages?.length || 0} pages, ${file.size} bytes`)

    // Return successful response
    const response: ParseResumeResponse = {
      text: normalizedText,
      pageCount: pdfData.Pages?.length || 0,
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

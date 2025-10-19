// API response types for PDF parsing
export interface ParseResumeResponse {
  text: string
  pageCount: number
  byteSize: number
}

export interface ParseResumeError {
  error: string
  details?: string
}

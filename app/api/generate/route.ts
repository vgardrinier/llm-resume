import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, mkdtemp } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_description, candidate_resume, company_vision } = body

    if (!job_description || !candidate_resume) {
      return NextResponse.json(
        { error: 'Job description and candidate resume are required' },
        { status: 400 }
      )
    }

    // Create temporary directory for files
    const tempDir = await new Promise<string>((resolve, reject) => {
      mkdtemp(join(tmpdir(), 'resume-gen-'), (err, dir) => {
        if (err) reject(err)
        else resolve(dir)
      })
    })

    try {
      // Write input files
      const jobDescPath = join(tempDir, 'job_description.txt')
      const resumePath = join(tempDir, 'current_resume.txt')
      const outputPath = join(tempDir, 'output.json')

      writeFileSync(jobDescPath, job_description)
      writeFileSync(resumePath, candidate_resume)

      if (company_vision) {
        const visionPath = join(tempDir, 'company_vision.txt')
        writeFileSync(visionPath, company_vision)
      }

      // Run Python script
      const pythonArgs = [
        'resume_generator.py',
        '--job-desc', jobDescPath,
        '--resume', resumePath,
        '--output', outputPath
      ]

      if (company_vision) {
        const visionPath = join(tempDir, 'company_vision.txt')
        pythonArgs.push('--company-vision', visionPath)
      }

      await new Promise<void>((resolve, reject) => {
        const python = spawn('python3', pythonArgs, {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let stdout = ''
        let stderr = ''

        python.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        python.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        python.on('close', (code) => {
          if (code !== 0) {
            console.error('Python script error:', stderr)
            reject(new Error(`Python script failed with code ${code}: ${stderr}`))
          } else {
            resolve()
          }
        })
      })

      // Read and parse result
      const resultContent = require('fs').readFileSync(outputPath, 'utf-8')
      const result = JSON.parse(resultContent)

      // Cleanup temp files
      try {
        unlinkSync(jobDescPath)
        unlinkSync(resumePath)
        unlinkSync(outputPath)
        if (company_vision) {
          unlinkSync(join(tempDir, 'company_vision.txt'))
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError)
      }

      return NextResponse.json(result)

    } catch (error) {
      // Cleanup on error
      try {
        require('fs').rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp directory:', cleanupError)
      }
      throw error
    }

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
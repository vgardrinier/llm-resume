import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip, Packer } from 'docx'
import type { StructuredResume } from '@/types/api'

export async function generateWordDocument(
  resume: StructuredResume,
  fileName: string
): Promise<void> {
  const children: Paragraph[] = []

  // Contact Info - Centered
  if (resume.contactInfo) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.contactInfo.name,
            bold: true,
            size: 32,
            font: 'Calibri'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      })
    )

    const contactDetails: string[] = []
    if (resume.contactInfo.email) contactDetails.push(resume.contactInfo.email)
    if (resume.contactInfo.phone) contactDetails.push(resume.contactInfo.phone)
    if (resume.contactInfo.location) contactDetails.push(resume.contactInfo.location)

    if (contactDetails.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: contactDetails.join(' • '),
              size: 20,
              font: 'Calibri'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 }
        })
      )
    }

    const links: string[] = []
    if (resume.contactInfo.linkedin) links.push(resume.contactInfo.linkedin)
    if (resume.contactInfo.website) links.push(resume.contactInfo.website)

    if (links.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: links.join(' | '),
              size: 20,
              font: 'Calibri',
              color: '0000FF'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        })
      )
    }
  }

  // Sections
  for (const section of resume.sections) {
    // Section Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title.toUpperCase(),
            bold: true,
            size: 22,
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 },
        border: {
          bottom: {
            color: '000000',
            space: 1,
            style: 'single',
            size: 12
          }
        }
      })
    )

    // Section Content
    if (typeof section.content === 'string') {
      // Simple text section (e.g., summary)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.content,
              size: 22,
              font: 'Calibri'
            })
          ],
          spacing: { after: 150 }
        })
      )
    } else if (Array.isArray(section.content)) {
      if (section.type === 'experience' || section.type === 'projects') {
        // Experience/Projects sections
        for (const entry of section.content as any[]) {
          if (typeof entry === 'string') continue // Skip if not an object
          // Job title (bold) with dates on same line (right-aligned is tricky, so use tabs)
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: entry.title,
                  bold: true,
                  size: 24,
                  font: 'Calibri'
                })
              ],
              spacing: { before: 150, after: 50 }
            })
          )

          // Company, location, and dates on one line
          const companyLocation = entry.location 
            ? `${entry.company} • ${entry.location}` 
            : entry.company
          
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: companyLocation,
                  size: 22,
                  font: 'Calibri'
                }),
                new TextRun({
                  text: `          ${entry.dates}`,
                  size: 22,
                  font: 'Calibri',
                  italics: true
                })
              ],
              spacing: { after: 100 }
            })
          )

          // Bullets
          if (entry.bullets && entry.bullets.length > 0) {
            for (const bullet of entry.bullets) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: bullet,
                      size: 22,
                      font: 'Calibri'
                    })
                  ],
                  bullet: { level: 0 },
                  spacing: { after: 80 }
                })
              )
            }
          }

          children.push(
            new Paragraph({
              text: '',
              spacing: { after: 100 }
            })
          )
        }
      } else if (section.type === 'skills') {
        // Skills section - display as comma-separated list
        const skillsText = (section.content as string[]).slice(0, 10).join(', ')
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: skillsText,
                size: 22,
                font: 'Calibri'
              })
            ],
            spacing: { after: 150 }
          })
        )
      } else if (section.type === 'education') {
        // Education section
        for (const entry of section.content as any[]) {
          if (typeof entry === 'string') continue // Skip if not an object
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: entry.degree,
                  bold: true,
                  size: 24,
                  font: 'Calibri'
                })
              ],
              spacing: { before: 150, after: 50 }
            })
          )

          if (entry.institution) {
            const institutionText = entry.location
              ? `${entry.institution}, ${entry.location}`
              : entry.institution

            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: institutionText,
                    size: 22,
                    font: 'Calibri'
                  })
                ],
                spacing: { after: 50 }
              })
            )
          }

          if (entry.date) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: entry.date,
                    size: 22,
                    font: 'Calibri'
                  })
                ],
                spacing: { after: 100 }
              })
            )
          }

          if (entry.details && entry.details.length > 0) {
            for (const detail of entry.details) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: detail,
                      size: 22,
                      font: 'Calibri'
                    })
                  ],
                  bullet: { level: 0 },
                  spacing: { after: 80 }
                })
              )
            }
          }
        }
      }
    }
  }

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.59), // 15mm
            bottom: convertInchesToTwip(0.59),
            left: convertInchesToTwip(0.79), // 20mm
            right: convertInchesToTwip(0.79)
          }
        }
      },
      children
    }]
  })

  // Generate and download
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


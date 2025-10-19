# LLM Resume Generator

A world-class résumé generator for technical and product talent that produces tailored one-page résumés optimized for ATS parsing and founder/engineer hybrid roles.

## Features

- **PDF Upload**: Upload your resume as a PDF and automatically extract text
- **ATS-Optimized**: Clean Markdown format without columns, tables, or images
- **Keyword Extraction**: Automatically identifies and incorporates relevant keywords from job descriptions
- **Tailored Content**: Adapts achievements and experience to match specific role requirements
- **Founder/Engineer Tone**: Results-driven language that appeals to both technical and business stakeholders
- **JSON Output**: Structured output with resume, fit summary, and keywords

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## PDF Upload Feature

The application supports uploading PDF resumes for automatic text extraction:

- **File Size Limit**: Maximum 1MB per file
- **File Type**: PDF files only (.pdf extension)
- **Text Extraction**: Server-side processing using pdf-parse
- **Text Normalization**: Automatically cleans whitespace and limits to 10,000 characters
- **Manual Fallback**: Manual text input remains available if PDF parsing fails
- **Error Handling**: Clear error messages for invalid files or parsing failures

### How PDF Upload Works

1. Click "Upload Resume (PDF)" button
2. Select a PDF file (≤1MB)
3. Text is automatically extracted and fills the resume field
4. Edit the extracted text as needed
5. Generate your tailored resume

If PDF parsing fails, you can always paste text manually in the textarea below.

## Input Requirements

The generator expects:
- **Job Description**: Plain text with role requirements and company info
- **Current Resume**: Your existing resume as PDF upload or pasted text
- **Company Vision** (optional): Additional company culture/vision text

## Output Format

The tool outputs a JSON response with:

```json
{
  "resume_md": "markdown resume text",
  "fit_summary": "3-line explanation of why the candidate fits the role",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
```

## Resume Guidelines

The generated resume follows these principles:

- **One Page**: Optimized for 500-700 words
- **Strong Action Verbs**: Built, Led, Architected, Scaled, etc.
- **Quantified Results**: Specific metrics and measurable achievements
- **Technical Keywords**: Relevant technologies and methodologies
- **Builder Mindset**: Emphasizes creation, leadership, and impact

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Anthropic Claude API
- **PDF Processing**: pdf-parse library
- **Deployment**: Vercel-ready

## Project Structure

```
llm-resume/
├── app/
│   ├── api/
│   │   ├── generate/          # Resume generation endpoint
│   │   └── parse-resume/      # PDF parsing endpoint
│   ├── page.tsx              # Main UI component
│   └── layout.tsx            # App layout
├── lib/
│   └── utils/
│       └── normalizePdfText.ts # PDF text normalization
├── types/
│   └── api.ts                # TypeScript interfaces
├── examples/                 # Sample files
└── README.md
```

## Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Type checking:**
   ```bash
   npm run type-check
   ```

4. **Linting:**
   ```bash
   npm run lint
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for your job applications!
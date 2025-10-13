# LLM Resume Generator

A world-class résumé generator for technical and product talent that produces tailored one-page résumés optimized for ATS parsing and founder/engineer hybrid roles.

## Features

- **ATS-Optimized**: Clean Markdown format without columns, tables, or images
- **Keyword Extraction**: Automatically identifies and incorporates relevant keywords from job descriptions
- **Tailored Content**: Adapts achievements and experience to match specific role requirements
- **Founder/Engineer Tone**: Results-driven language that appeals to both technical and business stakeholders
- **JSON Output**: Structured output with resume, fit summary, and keywords

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the generator:**
   ```bash
   python resume_generator.py --job-desc examples/job_description.txt --resume examples/current_resume.txt --output tailored_resume.json
   ```

3. **View the output:**
   ```bash
   cat tailored_resume.json
   ```

## Input Requirements

The generator expects:
- **Job Description**: Plain text file with role requirements and company info
- **Current Resume**: Your existing resume or LinkedIn summary as text
- **Company Vision** (optional): Additional company culture/vision text

## Output Format

The tool outputs a JSON file with:

```json
{
  "resume_md": "markdown resume text",
  "fit_summary": "3-line explanation of why the candidate fits the role",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
```

## Usage Examples

### Basic Usage
```bash
python resume_generator.py --job-desc job.txt --resume my_resume.txt
```

### With Company Vision
```bash
python resume_generator.py --job-desc job.txt --resume my_resume.txt --company-vision vision.txt --output custom_resume.json
```

### Programmatic Usage

```python
from resume_generator import ResumeGenerator, ResumeInput

generator = ResumeGenerator()
input_data = ResumeInput(
    job_description="Your job description here...",
    candidate_resume="Your current resume here...",
    company_vision="Optional company vision..."
)

result = generator.generate_resume(input_data)
print(result.to_json())
```

## Resume Guidelines

The generated resume follows these principles:

- **One Page**: Optimized for 500-700 words
- **Strong Action Verbs**: Built, Led, Architected, Scaled, etc.
- **Quantified Results**: Specific metrics and measurable achievements
- **Technical Keywords**: Relevant technologies and methodologies
- **Builder Mindset**: Emphasizes creation, leadership, and impact

## Project Structure

```
llm-resume/
├── resume_generator.py    # Main generator script
├── requirements.txt       # Python dependencies
├── examples/             # Sample input files
│   ├── job_description.txt
│   └── current_resume.txt
└── README.md             # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - feel free to use this for your job applications!
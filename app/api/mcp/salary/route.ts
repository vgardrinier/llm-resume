import { NextRequest, NextResponse } from 'next/server'

interface SalaryLookupRequest {
  role: string
  company?: string
  location: string
}

interface SalaryLookupResponse {
  low: number
  median: number
  high: number
  source: string
  role: string
  location: string
}

// Generate intelligent salary estimates based on role patterns
function generateIntelligentEstimate(role: string, location: string): SalaryLookupResponse {
  const roleLower = role.toLowerCase()
  const locationLower = location.toLowerCase()
  
  // Base salary multipliers by location
  const locationMultipliers: { [key: string]: number } = {
    'san francisco': 1.3,
    'sf': 1.3,
    'bay area': 1.3,
    'new york': 1.25,
    'nyc': 1.25,
    'manhattan': 1.25,
    'seattle': 1.2,
    'boston': 1.15,
    'austin': 1.1,
    'chicago': 1.1,
    'denver': 1.05,
    'remote': 1.0,
    'hybrid': 1.0
  }
  
  // Base salaries by role type
  const baseSalaries: { [key: string]: { low: number; median: number; high: number } } = {
    'engineer': { low: 100000, median: 130000, high: 160000 },
    'developer': { low: 95000, median: 125000, high: 155000 },
    'swe': { low: 100000, median: 130000, high: 160000 },
    'sde': { low: 100000, median: 130000, high: 160000 },
    'senior': { low: 140000, median: 170000, high: 200000 },
    'staff': { low: 160000, median: 190000, high: 220000 },
    'principal': { low: 180000, median: 220000, high: 260000 },
    'manager': { low: 150000, median: 180000, high: 220000 },
    'director': { low: 180000, median: 220000, high: 280000 },
    'vp': { low: 200000, median: 250000, high: 350000 },
    'product': { low: 120000, median: 150000, high: 180000 },
    'pm': { low: 120000, median: 150000, high: 180000 },
    'designer': { low: 90000, median: 120000, high: 150000 },
    'ux': { low: 90000, median: 120000, high: 150000 },
    'ui': { low: 90000, median: 120000, high: 150000 },
    'data': { low: 110000, median: 140000, high: 170000 },
    'scientist': { low: 110000, median: 140000, high: 170000 },
    'analyst': { low: 80000, median: 100000, high: 120000 },
    'marketing': { low: 80000, median: 110000, high: 140000 },
    'sales': { low: 70000, median: 100000, high: 130000 },
    'devops': { low: 120000, median: 150000, high: 180000 },
    'ml': { low: 130000, median: 160000, high: 190000 },
    'machine learning': { low: 130000, median: 160000, high: 190000 },
    'ai': { low: 130000, median: 160000, high: 190000 }
  }
  
  // Find matching role pattern
  let baseSalary = { low: 90000, median: 120000, high: 150000 } // default
  
  for (const [pattern, salary] of Object.entries(baseSalaries)) {
    if (roleLower.includes(pattern)) {
      baseSalary = salary
      break
    }
  }
  
  // Apply location multiplier
  const multiplier = locationMultipliers[locationLower] || 1.0
  
  return {
    low: Math.round(baseSalary.low * multiplier),
    median: Math.round(baseSalary.median * multiplier),
    high: Math.round(baseSalary.high * multiplier),
    source: 'AI Estimate',
    role,
    location
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SalaryLookupRequest = await request.json()
    const { role, location, company } = body

    // Validate required fields
    if (!role || !location) {
      return NextResponse.json(
        { error: 'Role and location are required' },
        { status: 400 }
      )
    }

    // Generate intelligent estimate
    const result = generateIntelligentEstimate(role, location)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Salary lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup salary data' },
      { status: 500 }
    )
  }
}

// Also support GET requests for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const location = searchParams.get('location')
  const company = searchParams.get('company')

  if (!role || !location) {
    return NextResponse.json(
      { error: 'Role and location are required' },
      { status: 400 }
    )
  }

  // Convert GET to POST format and call POST handler
  const mockRequest = {
    json: async () => ({ role, location, company })
  } as NextRequest

  return POST(mockRequest)
}

# Salary MCP Tool Definition
# This shows how the salary lookup would work as a proper MCP tool

## MCP Tool Schema

```json
{
  "tools": [
    {
      "name": "salary_lookup",
      "description": "Look up salary ranges for job roles and locations to provide context for resume optimization",
      "inputSchema": {
        "type": "object",
        "properties": {
          "role": {
            "type": "string",
            "description": "Job title or role (e.g., 'Senior Software Engineer', 'Product Manager')"
          },
          "location": {
            "type": "string", 
            "description": "Location (e.g., 'San Francisco', 'New York', 'Remote')"
          },
          "company": {
            "type": "string",
            "description": "Company name (optional, for more specific salary data)"
          }
        },
        "required": ["role", "location"]
      }
    }
  ]
}
```

## How It Would Work as a True MCP Tool

**Current Implementation:** API calls within our app
**True MCP Implementation:** Claude would directly call this tool

### Example MCP Tool Call:
```json
{
  "tool": "salary_lookup",
  "input": {
    "role": "Senior Product Manager",
    "location": "San Francisco",
    "company": "Google"
  }
}
```

### MCP Tool Response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Salary data for Senior Product Manager in San Francisco:\n- Low: $160,000\n- Median: $190,000\n- High: $220,000\n- Source: Levels.fyi\n\nThis is a high-value position worth optimizing for. The resume should reflect this compensation level."
    }
  ]
}
```

## Benefits of True MCP Implementation:

1. **Direct Claude Integration** - Claude can call the tool directly during resume generation
2. **Contextual Usage** - Claude decides when to use salary data based on the job description
3. **Dynamic Integration** - No need to pre-fetch salary data, Claude gets it when needed
4. **Tool Chaining** - Could be combined with other MCP tools (company research, market analysis, etc.)

## Current vs MCP Implementation:

**Current:** 
- We extract job title → call our API → get salary → add to prompt
- More manual, but gives us control over when/how it's used

**True MCP:**
- Claude sees job description → decides to call salary_lookup tool → gets salary data → uses it contextually
- More automated, but Claude controls the flow

Both approaches work! The current implementation gives us more control, while true MCP would be more integrated with Claude's decision-making process.

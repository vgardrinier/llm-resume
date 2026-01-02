# Known Issues

## 1. Job Description Extraction Still Incomplete (OpenAI careers)

**Status:** Partially fixed, still investigating

**Problem:**
- OpenAI careers pages use Cloudflare JS challenge + heavy client-side rendering
- Currently extracting only ~3.7k chars when full JD should be 15-20k+ chars
- This causes incomplete resume generation with hallucinated/repeated content

**What we fixed:**
- ✅ Added openai.com to JOB_PLATFORMS to force Puppeteer rendering
- ✅ Implemented deterministic extraction (JSON-LD, __NEXT_DATA__, meta tags)
- ✅ Smart main content extraction with nested div counting
- ✅ Content cleaning (remove nav/footer/scripts, cap at 40k)

**What's still broken:**
- ❌ Vision/text extraction from Puppeteer only getting partial content
- ❌ Need to investigate why extractWithVision returns incomplete JD

**Next steps:**
1. Check Puppeteer screenshot - is page fully rendered?
2. Check text extraction - is innerText missing content?
3. Try increasing wait time after page load
4. Consider using Firecrawl API for OpenAI pages

**Test case:**
```bash
curl -X POST http://localhost:3000/api/fetch-job \
  -H "Content-Type: application/json" \
  -d '{"url":"https://openai.com/careers/residency-2026-san-francisco/"}'
# Expected: 15-20k chars
# Actual: 3.7k chars
```

## 2. "Run Full Analysis" Button Failure

**Status:** Fixed with validation, may still have edge cases

**Problem:**
- Clicking "Run Full Analysis" from fast mode results shows error
- Returns to landing page with "Failed to complete analysis" message

**What we fixed:**
- ✅ Added validation to check jobDescription and currentResume exist
- ✅ Added detailed error logging to diagnose failures

**Next steps:**
- Test with complete job descriptions (after fixing #1)
- Check deep mode API for timeout issues
- Verify state persistence between fast → deep mode

## 3. Wrong Section Content in CV Output

**Status:** Not yet investigated

**Problem:**
- Microsoft section showing "Solidity smart contracts" (incorrect)
- Content being reused/hallucinated across sections
- Skills section being deleted

**Likely cause:**
- Incomplete job description (#1) causing generator to hallucinate
- OR: Bug in generator/curator logic

**Next steps:**
1. Fix job description extraction first (#1)
2. Test again to see if problem persists
3. If still broken, investigate:
   - app/api/analyze-fast/route.ts
   - app/api/generator/route.ts
   - app/api/curator/route.ts

---

## Testing

Test fixtures available in `test-fixtures/`:
- `victor-gardrinier-cv.pdf` - Test resume
- `test-config.json` - Test URLs and expected results
- `run-test.sh` - Automated test script

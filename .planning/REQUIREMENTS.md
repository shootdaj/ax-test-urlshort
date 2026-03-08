# Requirements

## R1: URL Shortening
- R1.1: Create short URL from long URL with auto-generated slug
- R1.2: Create short URL with custom slug
- R1.3: Redirect short URL to original URL (301)
- R1.4: Return 404 for non-existent slugs
- R1.5: Prevent duplicate custom slugs (409 conflict)

## R2: Click Analytics
- R2.1: Record click with timestamp, referrer, user-agent, IP
- R2.2: Return total click count per URL
- R2.3: Return clicks-by-day for last 30 days
- R2.4: Return top referrers

## R3: URL Management
- R3.1: List all URLs with click counts
- R3.2: Delete a URL and its analytics data

## R4: Performance
- R4.1: Redis cache for redirect lookups
- R4.2: Rate limiting on creation endpoint

## R5: Security
- R5.1: Input validation on URLs
- R5.2: Helmet security headers
- R5.3: CORS configuration

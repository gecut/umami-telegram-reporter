# Vendor Specification: Umami Analytics REST API

- **Vendor / Project**: Umami (Umami Software, Inc.)
- **Verified Versions**: v2.x / v3.x (contracts verified against `umami-software/umami` OpenAPI `public/openapi.json` and SQL query layer)
- **Retrieval Date**: 2026-10-17
- **Canonical Sources**:
  - Web: `https://umami.is/docs`
  - GitHub: `https://github.com/umami-software/umami`
  - API Client Spec: `packages/api-client/src/client.ts`

---

## 1. Authentication & Base URLs

### Base URLs
- **Umami Cloud**: `https://api.umami.is/v1`
- **Self-Hosted Umami**: `https://your-umami.domain.com/api` (or custom subpath)

### Authentication Headers
Umami supports two authentication mechanisms depending on deployment:
1. **API Key (Cloud & modern Self-Hosted)**:
   ```http
   x-umami-api-key: [REDACTED_API_KEY]
   ```
2. **Bearer Token (Self-Hosted login JWT or API token)**:
   ```http
   Authorization: Bearer [REDACTED_AUTH_TOKEN]
   ```

*Best practice implemented in reporter*: Send configured key as `x-umami-api-key` and as `Authorization: Bearer <key>` to ensure interoperability across all Umami versions.

---

## 2. Verified Endpoints & Query Parameters

### 2.1 Website Summary Stats
- **Method**: `GET`
- **Path**: `/api/websites/{websiteId}/stats`
- **Query Parameters**:
  - `startAt` (number, required): Start of period in Unix epoch milliseconds.
  - `endAt` (number, required): End of period in Unix epoch milliseconds.
  - `compare` (string, optional): `'prev'` (default) or `'yoy'`. When specified, Umami calculates the previous period of identical duration and includes comparison figures.
- **Verified Response Payload (Current v2/v3)**:
  ```json
  {
    "pageviews": 1420,
    "visitors": 610,
    "visits": 730,
    "bounces": 180,
    "totaltime": 95400,
    "comparison": {
      "pageviews": 1200,
      "visitors": 550,
      "visits": 680,
      "bounces": 190,
      "totaltime": 82000
    }
  }
  ```
- **Legacy Shape Support**: In older Umami v1 / early-v2 instances, the response was formatted as:
  ```json
  {
    "pageviews": { "value": 1420, "prev": 1200 },
    "visitors": { "value": 610, "prev": 550 },
    "visits": { "value": 730, "prev": 680 },
    "bounces": { "value": 180, "prev": 190 },
    "totaltime": { "value": 95400, "prev": 82000 }
  }
  ```
  *The reporter normalizer supports both formats seamlessly.*

---

### 2.2 Ranked Metrics Breakdown
- **Method**: `GET`
- **Path**: `/api/websites/{websiteId}/metrics`
- **Query Parameters**:
  - `type` (string, required):
    - `path` (or `url`): Top viewed page paths.
    - `referrer`: Top referring external domains.
    - `utmSource`: Top UTM source campaign channels.
    - `utmMedium`: Top UTM mediums.
    - `utmCampaign`: Top UTM campaigns.
    - `utmContent`: Top UTM content variations.
    - `event`: Custom event trigger frequency.
  - `startAt` (number, required): Start in Unix epoch milliseconds.
  - `endAt` (number, required): End in Unix epoch milliseconds.
  - `limit` (number, optional): Maximum records to return (default: 500; reporter specifies 5).
  - Dimensional filters (optional): e.g. `utmSource=Instagram` when querying `type=utmContent`.
- **Verified Response Payload**:
  ```json
  [
    { "x": "/", "y": 820 },
    { "x": "/products", "y": 340 },
    { "x": "/checkout", "y": 110 }
  ]
  ```
- **CRITICAL DATA SEMANTICS**:
  - In Umami SQL (`src/queries/sql/pageviews/getPageviewMetrics.ts`), `y` for `path`, `referrer`, and `utm*` is:
    `count(distinct website_event.session_id) as y`
  - **`y` IS UNIQUE VISITORS**, not pageviews!
  - For `type=event`, `y` is `count(*)`, representing total event executions.

---

### 2.3 Custom Event Totals & Comparison
- **Method**: `GET`
- **Path**: `/api/websites/{websiteId}/events/stats` (or filtering via `/api/websites/{websiteId}/metrics?type=event`)
- **Query Parameters**:
  - `startAt`, `endAt`: Epoch milliseconds.
  - `event` (optional): Filter to specific event name.
- **Response**:
  ```json
  {
    "data": {
      "events": 45,
      "visitors": 38,
      "visits": 40,
      "uniqueEvents": 2,
      "comparison": {
        "events": 30,
        "visitors": 25,
        "visits": 28,
        "uniqueEvents": 2
      }
    }
  }
  ```

---

## 3. Error Codes & Handling Rules

| Status Code | Cause | Action |
| :--- | :--- | :--- |
| **400 Bad Request** | Invalid date range or unsupported filter parameter | Fail immediately; do not retry. |
| **401 Unauthorized** | Missing or expired token/key | Fail immediately; log error reference. |
| **403 Forbidden** | User role does not have permission for website | Fail immediately; check project mapping. |
| **404 Not Found** | `websiteId` does not exist | Fail immediately; verify `projects.json`. |
| **429 Too Many Requests** | Rate limit reached | Back off using `Retry-After` header (up to 15s), retry up to 3 times. |
| **5xx Server Error** | Umami instance restart / DB timeout | Exponential backoff with random jitter, retry up to 3 times. |

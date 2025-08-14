# SV Advisor FE

Simple React + Vite frontend to browse Standvirtual listings marked "Abaixo da média" using the backend endpoints provided.

## Prerequisites
- Node.js 18+
- Backend API running locally at http://localhost:8080 (see endpoints in API docs). This app calls `/api/sent-adverts`.

## Development
1. Install deps
   - `npm install`
2. Start dev server
   - `npm run dev`
3. Open the URL shown in your terminal (usually http://localhost:5173)

The dev server proxies `/api` to `http://localhost:8080` (configured in `vite.config.js`).

## Features
- Fetches `/api/sent-adverts` and displays results in a table
- Client-side filters:
  - Brand, Fuel, Gearbox (selects populated from data)
  - Year min/max, Price min/max, Max diff vs min
  - Free text search across title and brand
- Sorting by default on lowest diff vs min first
- Clickable column headers: toggle ascending/descending sorting on any column (e.g., Year desc)
- Refresh button and clear filters
- Basic loading and error states

## Notes
- The expected item shape is SentAdvert from the API:
  - id, advertId, url, title, advertCreatedAt, price, minPrice, maxPrice, diffPriceMinPrice, year, fuelType, gearbox, brand, sentAt, lastDifference.
- If the backend is not running or returns an error, you will see an error message.

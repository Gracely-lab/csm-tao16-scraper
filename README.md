# CSM Taobao/1688 Scraper + Translator

A Node.js service that:
- Scrapes products from Taobao/1688
- Translates product titles, descriptions, and text inside images
- Imports products into WooCommerce

## API Endpoints
- `POST /scrape` → Scrape product details + auto-translate
- `POST /import` → Import product into WooCommerce with translations
- `GET /` → Test server

## Example Request
```bash
POST https://your-app.onrender.com/scrape
{
  "url": "https://detail.1688.com/offer/902504157053.html"
}

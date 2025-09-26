const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const translate = require("@vitalets/google-translate-api");
const Tesseract = require("tesseract.js");
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// WooCommerce API setup
const api = new WooCommerceRestApi({
  url: "https://cheapershoppingmall.com",
  consumerKey: "ck_dfaea82361449d413954b02e45626a9120cb82f9",
  consumerSecret: "cs_78dcf0ed552f9efcb917eec9c50632451408c33f",
  version: "wc/v3",
});

// Function: Translate text
async function translateText(text) {
  try {
    const result = await translate(text, { to: "en" });
    return result.text;
  } catch (err) {
    console.error("Translation failed:", err.message);
    return text; // fallback to original
  }
}

// Function: OCR + translate image text
async function translateImageText(imageUrl) {
  try {
    const result = await Tesseract.recognize(imageUrl, "chi_sim"); // Chinese simplified
    const extracted = result.data.text.trim();
    if (!extracted) return null;
    return await translateText(extracted);
  } catch (err) {
    console.error("OCR failed:", err.message);
    return null;
  }
}

// Scrape product from Taobao/1688
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing product URL" });

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const rawTitle = $("title").text().trim();
    const translatedTitle = await translateText(rawTitle);

    const images = [];
    $("img").each((i, el) => {
      let src = $(el).attr("src");
      if (src && !src.startsWith("data:")) images.push(src);
    });

    // OCR first image for translation
    let imageTextTranslations = [];
    if (images.length > 0) {
      for (let i = 0; i < Math.min(images.length, 3); i++) {
        const text = await translateImageText(images[i]);
        if (text) imageTextTranslations.push({ image: images[i], text });
      }
    }

    res.json({
      rawTitle,
      translatedTitle,
      images: [...new Set(images)].slice(0, 10),
      imageTextTranslations,
      source: url,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

// Import product into WooCommerce
app.post("/import", async (req, res) => {
  const { title, images, price, description } = req.body;
  if (!title) return res.status(400).json({ error: "Missing product title" });

  try {
    const translatedTitle = await translateText(title);
    const translatedDescription = description
      ? await translateText(description)
      : "";

    const productData = {
      name: translatedTitle,
      type: "simple",
      regular_price: price || "10.00",
      description: translatedDescription,
      images: images ? images.map((src) => ({ src })) : [],
    };

    const response = await api.post("products", productData);

    res.json({
      success: true,
      product: response.data,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ error: "Import failed", details: err.response?.data || err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ CSM Taobao/1688 Scraper + Translator is running!");
});

app.listen(PORT, () => {
  console.log(`Scraper running on port ${PORT}`);
});

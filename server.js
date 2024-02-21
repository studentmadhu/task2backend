const express = require("express");
const mysql = require("mysql");
const path = require("path");
const SolrNode = require("solr-node");
const app = express();
const port = 5000;
const cors = require("cors");

app.use(
  cors({
    origin: "*",
  })
);

const solrClient = new SolrNode({
  host: "192.168.55.196",
  port: "8983",
  core: "sample2",
  protocol: "http",
});

const connection = mysql.createConnection({
  host: "192.168.55.196",
  user: "root",
  password: "Madhu@123",
  database: "my_database",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: " + err.stack);
    return;
  }
  console.log("Connected to MySQL database as id " + connection.threadId);
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/frontendserver/category.html"));
});

app.get("/category", (req, res) => {
  const limit = 5;
  const page = parseInt(req.query.page) || 1; //query parameter that comes after ?
  const offset = (page - 1) * limit;

  // Query to fetch data for the current page along with total count
  const query = `
    SELECT *,
      (SELECT COUNT(*) FROM category) AS totalRecords
    FROM category
    LIMIT ${limit} OFFSET ${offset}`;

  connection.query(query, (error, results) => {
    if (error) {
      console.error("Error executing MySQL query: " + error.stack);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // Calculate total pages based on total count and limit
    const totalRecords = results.length > 0 ? results[0].totalRecords : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      data: results,
      currentPage: page,
      totalPages: totalPages,
    });
  });
});

app.get("/category/:categoryId", (req, res) => {
  const categoryId = req.params.categoryId;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Query products based on category ID with pagination and get total count
  const query = `
    SELECT *,
      (SELECT COUNT(*) FROM product WHERE category_id = ${categoryId}) AS totalRows
    FROM product
    WHERE category_id = ${categoryId}
    LIMIT ${limit} OFFSET ${offset}`;

  connection.query(query, (error, results) => {
    if (error) {
      console.error("Error executing MySQL query: " + error.stack);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const totalRows = results.length > 0 ? results[0].totalRows : 0;
    const totalPages = Math.ceil(totalRows / limit);

    // Fetch categories for dropdown menu
    connection.query(
      "SELECT category_id, category_name FROM category",
      (error, categories) => {
        if (error) {
          console.error("Error fetching categories: " + error.stack);
          res.status(500).json({ error: "Internal server error" });
          return;
        }

        const responseData = {
          products: results,
          categories: categories,
          selectedCategoryId: categoryId,
          currentPage: page,
          totalPages: totalPages,
        };
        res.json(responseData);
      }
    );
  });
});

app.get("/category/100/product-all", (req, res) => {
  const limit = 15;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  // Query to fetch data for the current page and get total count
  const query = `
    SELECT *,
      (SELECT COUNT(*) FROM product) AS totalRecords
    FROM product
    LIMIT ${limit} OFFSET ${offset}`;

  connection.query(query, (error, result) => {
    if (error) {
      console.error("Error executing MySQL query: " + error.stack);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const totalRecords = result.length > 0 ? result[0].totalRecords : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Query to fetch categories
    connection.query(
      "SELECT category_id, category_name FROM category",
      (error, categories) => {
        if (error) {
          console.error("Error fetching categories: " + error.stack);
          res.status(500).json({ error: "Internal server error" });
          return;
        }

        const selectedCategoryId = "view all products";

        // Construct response object
        const responseObject = {
          products: result,
          categories: categories,
          selectedCategoryId: selectedCategoryId,
          currentPage: page,
          totalPages: totalPages,
        };

        res.json(responseObject);
      }
    );
  });
});

app.get("/category/search/:searchType/:search", (req, res) => {
  const searchType = req.params.searchType;
  const searchQuery = req.params.search;

  if (searchType === "number") {
    // Handle number search
    const numbers = searchQuery.match(/\d+/g);
    const cleanedSentence = searchQuery.replace(
      /\b(?:under|on|in|from|above|below)\b\s*/gi,
      ""
    );
    const wordsArray = cleanedSentence
      .trim()
      .split(" ")
      .filter((word) => word.trim() !== "");
    const number = numbers ? numbers[0] : null;
    const discountKeywords = ["from", "under", "above", "on", "in", "below"];
    let value = "";

    if (number) {
      let minDistance = Infinity;
      let closestKeyword = null;

      searchQuery.split(" ").forEach((keyword) => {
        if (discountKeywords.includes(keyword)) {
          const distance = Math.abs(
            searchQuery.indexOf(number) - searchQuery.indexOf(keyword)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestKeyword = keyword;
          }
        }
      });

      switch (closestKeyword) {
        case "from":
        case "above":
          value = `discount_price:[${number} TO *]`;
          break;
        case "under":
        case "below":
          value = `discount_price:[* TO ${number}]`;
          break;
        case "on":
        case "in":
          value = `discount_price:${number}`;
          break;
        default:
          break;
      }
    }

    let solrQuery = solrClient.query().rows(100);
    let productNameCondition = "";
    let brandNameCondition = "";
    let category_name = "";

    if (wordsArray.length > 0) {
      productNameCondition = wordsArray
        .map((word) => `(product_name:${word})`)
        .join("  ");
      brandNameCondition = wordsArray
        .map((word) => `(brand_name:${word})`)
        .join("  ");
      category_name = wordsArray
        .map((word) => `(category_name:${word})`)
        .join("  ");
    }

    const combinedCondition = [
      productNameCondition,
      brandNameCondition,
      category_name,
    ]
      .filter((condition) => condition !== "")
      .join(" OR ");

    if (combinedCondition && value) {
      solrQuery = solrQuery.q(`(${combinedCondition}) AND ${value}`);
    } else {
      res.status(400).json({ error: "Invalid search query" });
      return;
    }

    solrClient.search(solrQuery, (err, result) => {
      if (err) {
        console.error("Error executing Solr query:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      const documents = result.response.docs;
      res.json({ products: documents });
    });
  } else {
    // Handle sentence or single search
    const searchTerms = searchQuery.split(" ");
    let productQuery = "";
    let brandQuery = "";
    let category = " ";

    searchTerms.forEach((term, index) => {
      if (index > 0) {
        productQuery += " ";
        brandQuery += " ";
        category += " ";
      }
      productQuery += `product_name:${term}`;
      brandQuery += `brand_name:${term}`;
      category += `category_name:${term}`;
    });

    let solrQuery = solrClient.query().rows(100);

    switch (searchType) {
      case "single":
        solrQuery = solrQuery.q(
          `(${productQuery}~1 OR ${brandQuery} OR product_name:black${searchQuery} OR ${category})`
        );
        break;
      case "sentence":
        solrQuery = solrQuery.q(
          `(${productQuery}) AND (${brandQuery}) AND ${category}`
        );
        break;
      default:
        res.status(400).json({ error: "Invalid search type" });
        return;
    }

    solrClient.search(solrQuery, (err, result) => {
      if (err) {
        console.error("Error executing Solr query:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      const documents = result.response.docs;

      if (documents.length === 0 && searchType === "sentence") {
        const fallbackQuery = solrClient
          .query()
          .q(`(${productQuery}) OR (${brandQuery}) OR ${category}`)
          .rows(100);

        solrClient.search(fallbackQuery, (err, fallbackResult) => {
          if (err) {
            console.error("Error executing fallback Solr query:", err);
            res.status(500).json({ error: "Internal server error" });
            return;
          }

          const fallbackDocuments = fallbackResult.response.docs;
          res.json({ products: fallbackDocuments });
        });
      } else {
        res.json({ products: documents });
      }
    });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

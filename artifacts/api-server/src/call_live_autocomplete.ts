import express from "express";
import http from "http";
import foodsRouter from "./routes/foods";

async function startAndFetch() {
  const app = express();
  app.use(express.json());
  app.use("/api", foodsRouter);

  const server = app.listen(5006, () => {
    http.get("http://localhost:5006/api/foods/autocomplete?q=%D9%85%D9%86", (res) => {
      let rawData = "";
      res.on("data", (chunk) => (rawData += chunk));
      res.on("end", () => {
        console.log("REAL_HTTP_RESPONSE_START");
        try {
          const parsed = JSON.parse(rawData);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(rawData);
        }
        console.log("REAL_HTTP_RESPONSE_END");
        server.close();
        process.exit(0);
      });
    }).on("error", (err) => {
      console.error("HTTP Fetch Error:", err);
      server.close();
      process.exit(1);
    });
  });
}

startAndFetch().catch(console.error);

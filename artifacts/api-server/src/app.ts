import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import privacyRouter from "./routes/privacy";
import { logger } from "./lib/logger";

import cookieParser from "cookie-parser";
import { seedInitialAdmin } from "./lib/adminAuth";
import { ensureLeadsTable } from "./routes/leads";

const app: Express = express();

// Seed initial local admin account idempotently on app startup
seedInitialAdmin().catch(console.error);
ensureLeadsTable().catch(console.error);


const isDev = process.env.NODE_ENV !== "production";

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);

const defaultDevOrigins = [
  "http://localhost:22133",
  "http://127.0.0.1:22133",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
];

const allowedOriginsList = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        allowedOriginsList.includes(origin) ||
        defaultDevOrigins.includes(origin) ||
        (isDev && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")))
      ) {
        return callback(null, true);
      }

      if (allowedOriginsList.length === 0) {
        return callback(null, true);
      }

      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => isDev,
});

const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis rate limit exceeded. Please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production" || process.env.LOCAL_DEV === "true",
});

// Tight limit for auth endpoints — 10 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
  skip: () => isDev,
});

// Registration limiter — 5 new accounts per IP per hour to curb bot sign-ups.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created from this IP. Please try again later." },
  skip: () => isDev,
});

app.use(globalLimiter);
app.use("/api/analysis", analysisLimiter);
app.use("/api/users/register", registerLimiter);
app.use("/api/users/login", authLimiter);
app.use("/api/users/forgot-password", authLimiter);
app.use("/api/users/reset-password-with-code", authLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use("/api/admin/login", authLimiter);

app.use("/api", router);
app.use("/privacy", privacyRouter);

export default app;

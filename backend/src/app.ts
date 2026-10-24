import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { allowedOrigins } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { healthRouter } from "./routes/health.js";
import { collectionsRouter } from "./routes/collections.js";
import { imagesRouter } from "./routes/images.js";
import { tagsRouter } from "./routes/tags.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, "Origin ist nicht erlaubt"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/api/health", healthRouter);
app.use("/api/images", imagesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/collections", collectionsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route nicht gefunden" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Ungültige Anfrage", details: error.issues });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Interner Serverfehler" });
};

app.use(errorHandler);

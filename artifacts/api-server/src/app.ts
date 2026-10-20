import express, { type Express, type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Input tidak sah", issues: err.issues });
    return;
  }
  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Ralat dalaman pelayan" });
};
app.use(errorHandler);

export default app;

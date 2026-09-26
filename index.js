import express from "express";
import { router as urlRoute } from "./routes/url.js";
import { router as visitorRouter } from "./routes/visitor.js";
import { connectToDb } from "./connect.js";
import { redirectLimiter } from "./middleware/rateLimiter.js";
import { URL } from "./models/url.js";
import "dotenv/config";
import cors from "cors";
const app = express();
const PORT = 5001;

app.set("trust proxy", 1);

connectToDb(process.env.MONGOURL)
  .then(() => console.log("connected to the db successfully"))
  .catch((err) => {
    console.log(err);
  });

app.use(express.json());
app.use(cors());
app.use("/url", urlRoute);
app.use("/visitors", visitorRouter);

app.get("/:shortId", redirectLimiter, async (req, res) => {
  const shortId = req.params.shortId;
  const entry = await URL.findOneAndUpdate(
    {
      shortId,
    },
    {
      $push: {
        visitHistory: {
          timeStamps: Date.now(),
        },
      },
    },
  );

  res.redirect(entry.redirectUrl);
});
app.listen(PORT, () => console.log(`server is started on PORT:${PORT}`));

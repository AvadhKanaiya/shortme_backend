
import express from 'express';
import { router as urlRoute } from "./routes/url.js";
import { router as visitorRouter } from "./routes/visitor.js";
import { connectToDb } from './connect.js';
import { URL } from './models/url.js';
import 'dotenv/config';
import cors from "cors";
const app = express();
const PORT = 5001;

connectToDb(process.env.MONGOURL).then(() => console.log("connected to the db successfully")).catch(err => { console.log(err) });


app.use(express.json());
app.use(cors());
app.use('/url', urlRoute);
app.use('/visitors', visitorRouter);

app.get('/:shortId', async (req, res) => {
    const shortId = req.params.shortId;
    const entry = await URL.findOneAndUpdate({
        shortId
    }, {
        $push: {
            visitHistory: {
                timeStamps: Date.now(),
            },
        },
    });

    res.redirect(entry.redirectUrl);
})
app.listen(PORT, () => console.log(`server is started on PORT:${PORT}`));
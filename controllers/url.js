
import shortid from 'shortid';


import { URL } from "../models/url.js";
async function handleGenerateNewShortUrl(req, res) {
    const body = req.body;
    if (!body.url) return res.status(400).json({ message: "Url is required" });
    const shortId = shortid();
    await URL.create({
        shortId: shortId,
        redirectUrl: body.url,
        visitHistory: [],
    });

    return res.json({ id: shortId });
}

async function handleGetAnalytics(req, res) {
    const shortId = req.params.shortId;
    const result = await URL.findOne({ shortId });
    return res.json({ viewers: result.visitHistory.length, analytics: result.visitHistory });
}
export {
    handleGenerateNewShortUrl,
    handleGetAnalytics
}
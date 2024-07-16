import { Visitors } from "../models/visitor.js"


async function handleVisitorCount(req, res) {
    try {
        let visitor = await Visitors.findOne();
        if (!visitor) {
            visitor = new Visitors({ count: 1 });
            await visitor.save();
        } else {
            visitor.count += 1;
            await visitor.save();
        }
        res.json({ count: visitor.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export { handleVisitorCount };
import mongoose from "mongoose";
const visitorSchema = new mongoose.Schema({
    count: {
        type: Number,
        defaul: 0
    },
}, { timestamps: true });

const Visitors = mongoose.model('visitors', visitorSchema);
export { Visitors };

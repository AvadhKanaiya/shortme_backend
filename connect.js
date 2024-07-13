
import mongoose from "mongoose";
async function connectToDb(url) {
    return mongoose.connect(url);
}
export { connectToDb };
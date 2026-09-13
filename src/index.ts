import mongoose from "mongoose";
import { app } from "./app.js";
import { config } from "./config.js";

async function main() {
  await mongoose.connect(config.mongodbUri);
  app.listen(config.port, () => {
    console.log(`Spam checker listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { MongoClient, Collection, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "omnidb";

export async function getDb(): Promise<Db> {
  if (db) return db;

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const newClient = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await newClient.connect();
  client = newClient;
  db = newClient.db(DB_NAME);
  return db;
}

export async function getCollection(
  name: string
): Promise<Collection> {
  return (await getDb()).collection(name);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

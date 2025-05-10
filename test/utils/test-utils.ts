import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Test utilities for MongoDB testing
 */
export class MongoTestUtils {
  private static mongoServer: MongoMemoryServer;

  /**
   * Connect to an in-memory MongoDB server
   */
  static async connect(): Promise<mongoose.Connection> {
    // Start MongoDB in-memory server
    this.mongoServer = await MongoMemoryServer.create();
    const uri = this.mongoServer.getUri();

    // Connect mongoose to the MongoDB memory server
    await mongoose.connect(uri);

    return mongoose.connection;
  }

  /**
   * Disconnect from the in-memory MongoDB server
   */
  static async disconnect(): Promise<void> {
    await mongoose.disconnect();
    await this.mongoServer.stop();
  }

  /**
   * Clear all collections in the database
   */
  static async clearDatabase(): Promise<void> {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
}

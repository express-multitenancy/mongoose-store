import { Tenant, Store } from "express-multitenancy";
import mongoose, { Schema, Model } from "mongoose";
import { exemptModels } from './mongoose-plugin';

// Define default Tenant schema for Mongoose
const defaultTenantSchema = new Schema<Tenant>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true }
});

/**
 * Configuration options for MongooseStore.
 * 
 * @typeParam T - Type of tenant, must extend the base Tenant interface
 */
interface MongooseStoreOptions<T extends Tenant = Tenant> {
  /**
   * Name for the Mongoose model. Defaults to 'Tenant'.
   */
  modelName?: string;
  
  /**
   * Mongoose database connection
   */
  connection: mongoose.Connection;
  
  /**
   * Custom schema for the tenant model. If not provided, a default schema is used.
   */
  schema?: Schema<T>;
  
  /**
   * Custom pre-defined Mongoose model. If provided, modelName and schema are ignored.
   */
  model?: Model<T>;
}

/**
 * MongoDB-based tenant storage using Mongoose.
 * 
 * This store keeps tenants in a MongoDB collection and is suitable for
 * production applications or when you need to manage tenants dynamically.
 * 
 * @typeParam T - Type of tenant, must extend the base Tenant interface
 * 
 * @example
 * ```
 * // Using default schema
 * const store = new MongooseStore({
 *   connection: mongoose.connection
 * });
 * 
 * // Using custom model
 * const store = new MongooseStore({
 *   connection: mongoose.connection,
 *   model: CustomTenantModel
 * });
 * ```
 */
export class MongooseStore<T extends Tenant = Tenant> implements Store<T> {
  private TenantModel: Model<T>;

  /**
   * Creates a new MongoDB-based tenant store.
   * 
   * @param options - Configuration options
   * @throws Error if connection is not provided or custom model doesn't have required fields
   */
  constructor(options: MongooseStoreOptions<T>) {
    const { 
      modelName = 'Tenant', 
      connection, 
      schema = defaultTenantSchema as unknown as Schema<T>, 
      model 
    } = options;
    
    if (!connection) {
      throw new Error('MongoDB connection is required for MongooseStore');
    }
    
    if (model) {
      // Use the provided custom model
      this.TenantModel = model;
      
      // Validate that the model schema contains the required fields
      const modelPaths = Object.keys(this.TenantModel.schema.paths);
      if (!modelPaths.includes('id') || !modelPaths.includes('name')) {
        throw new Error('Custom tenant model must include "id" and "name" fields');
      }
    } else {
      // Create model from schema if no model is provided
      this.TenantModel = connection.model<T>(modelName, schema);
    }
    
    // Add the Tenant model to the exemptModels set
    exemptModels.add(this.TenantModel.modelName);
    console.log(`[MongooseStore] Added ${this.TenantModel.modelName} to exempt models`);
  }

  async getAll(): Promise<T[]> {
    return await this.TenantModel.find().lean() as T[];
  }
  
  async add(tenant: T): Promise<T> {
    await this.TenantModel.create(tenant);
    return tenant;
  }

  async getById(id: string): Promise<T | null> {
    return await this.TenantModel.findOne({ id }).lean() as T | null;
  }

  async getByName(name: string): Promise<T | null> {
    return await this.TenantModel.findOne({ name }).lean() as T | null;
  }
}
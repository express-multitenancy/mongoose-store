"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongooseStore = void 0;
const mongoose_1 = require("mongoose");
const mongoose_plugin_1 = require("./mongoose-plugin");
// Define default Tenant schema for Mongoose
const defaultTenantSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true }
});
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
class MongooseStore {
    /**
     * Creates a new MongoDB-based tenant store.
     *
     * @param options - Configuration options
     * @throws Error if connection is not provided or custom model doesn't have required fields
     */
    constructor(options) {
        const { modelName = 'Tenant', connection, schema = defaultTenantSchema, model } = options;
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
        }
        else {
            // Create model from schema if no model is provided
            this.TenantModel = connection.model(modelName, schema);
        }
        // Add the Tenant model to the exemptModels set
        mongoose_plugin_1.exemptModels.add(this.TenantModel.modelName);
        console.log(`[MongooseStore] Added ${this.TenantModel.modelName} to exempt models`);
    }
    async getAll() {
        return await this.TenantModel.find().lean();
    }
    async add(tenant) {
        await this.TenantModel.create(tenant);
        return tenant;
    }
    async getById(id) {
        return await this.TenantModel.findOne({ id }).lean();
    }
    async getByName(name) {
        return await this.TenantModel.findOne({ name }).lean();
    }
}
exports.MongooseStore = MongooseStore;

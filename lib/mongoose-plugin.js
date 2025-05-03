"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exemptModels = void 0;
exports.multitenancyPlugin = multitenancyPlugin;
const express_multitenancy_1 = require("express-multitenancy");
/**
 * Set of model names that should be exempt from tenant filtering.
 *
 * Models in this set will not have tenant filters applied automatically.
 * By default, the Tenant model is added to this set.
 */
exports.exemptModels = new Set();
/**
 * Mongoose plugin that adds multi-tenancy support to schemas.
 *
 * This plugin:
 * 1. Adds a tenantId field to the schema if it doesn't exist
 * 2. Automatically filters queries by the current tenant context
 * 3. Sets the tenantId on new documents based on the current tenant context
 *
 * @param schema - Mongoose schema to apply the plugin to
 * @param options - Configuration options for the plugin
 *
 * @example
 * ```
 * // Apply to a specific schema
 * userSchema.plugin(multitenancyPlugin);
 *
 * // Apply globally to all schemas
 * mongoose.plugin(multitenancyPlugin);
 * ```
 */
function multitenancyPlugin(schema, options) {
    // Add exempt models from options to the exemptModels set
    if (options?.exemptModels) {
        for (const modelName of options.exemptModels) {
            exports.exemptModels.add(modelName);
        }
    }
    // Check if model is in a collection of exemptModels
    // This is best-effort as the model might not be registered yet
    const modelName = schema.options?.collection;
    const isExemptModel = modelName && exports.exemptModels.has(modelName);
    // Add tenantId field to schema if it doesn't exist
    if (!schema.path('tenantId')) {
        console.warn('Adding tenantId field to schema');
        schema.add({
            tenantId: {
                type: String,
                // Only make it required for non-exempt models
                required: !isExemptModel
            }
        });
    }
    console.log('Applying multitenancy plugin to schema');
    // Apply tenant filter to all find queries (find, findOne, findOneAndUpdate, etc.)
    schema.pre(/^find/, function (next) {
        // Check if this model should be exempt
        if (this.model && exports.exemptModels.has(this.model.modelName)) {
            return next();
        }
        const tenantId = express_multitenancy_1.tenantContext.getStore();
        // Only apply filter if there's a tenant in the context and query doesn't already have tenantId
        if (tenantId && !this.getQuery().tenantId) {
            console.log(`[Query] Adding tenant filter: { tenantId: ${tenantId} }`);
            this.where({ tenantId });
        }
        // If returnTenantId is true, include tenantId in the results
        if (!options?.returnTenantId) {
            this.select('-tenantId');
        }
        next();
    });
    // Apply tenant filter to count queries
    schema.pre(/^count/, function (next) {
        // Check if this model should be exempt
        if (this.model && exports.exemptModels.has(this.model.modelName)) {
            return next();
        }
        const tenantId = express_multitenancy_1.tenantContext.getStore();
        if (tenantId && !this.getQuery().tenantId) {
            this.where({ tenantId });
        }
        next();
    });
    // Apply tenant ID on document save
    schema.pre('save', function (next) {
        // Check if this model should be exempt
        if (this.constructor && exports.exemptModels.has(this.constructor.modelName)) {
            console.log(`[Save] Skipping tenantId setting for exempt model: ${this.constructor.modelName}`);
            return next();
        }
        const tenantId = express_multitenancy_1.tenantContext.getStore();
        console.log(`[Save] Current tenant context: ${tenantId || 'none'}`);
        if (tenantId && !this.get('tenantId')) {
            console.log(`[Save] Setting tenantId to ${tenantId}`);
            this.set('tenantId', tenantId);
        }
        else if (!tenantId) {
            console.log('[Save] No tenant context found when saving document');
        }
        next();
    });
}

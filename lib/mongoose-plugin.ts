import { Schema } from 'mongoose';
import { tenantContext } from 'express-multitenancy';

/**
 * Set of model names that should be exempt from tenant filtering.
 *
 * Models in this set will not have tenant filters applied automatically.
 * By default, the Tenant model is added to this set.
 */
export const exemptModels = new Set<string>();

/**
 * Configuration options for the multitenancy plugin.
 */
export interface MultitenancyPluginOptions {
  /**
   * Array of model names that should be exempt from tenant filtering.
   * Models in this list will not have tenant filters automatically applied.
   */
  exemptModels?: string[];

  /**
   * Whether to hide tenantId in the response.
   * If false (default), tenantId is included in the response.
   */
  hideTenantId?: boolean;

  /**
   * Whether to enable debug logging.
   * If true, additional logs will be printed for debugging purposes.
   */
  debug?: boolean;
}

/**
 * Mongoose plugin that adds multi-tenancy support to schemas.
 *
 * This plugin:
 * 1. Adds a tenantId field to the schema if it doesn't exist (for non-exempt models)
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
export function multitenancyPlugin(schema: Schema, options: MultitenancyPluginOptions = {}): void {
  // Add exempt models from options to the exemptModels set
  if (options?.exemptModels) {
    for (const modelName of options.exemptModels) {
      exemptModels.add(modelName);
    }
  }

  if (options?.debug) {
    console.log('Applying multitenancy plugin to schema');
  }

  // We need to add the tenantId field conditionally with dynamic validation
  // since we don't know the model name at plugin time
  if (!schema.path('tenantId')) {
    // Only add tenantId for models that aren't in the exemptModels set
    const tenantIdField = {
      type: String,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      required: function (this: any) {
        // Check if model is exempt at validation time
        if (this.constructor && exemptModels.has(this.constructor.modelName)) {
          return false;
        }
        return true;
      },
    };
    schema.add({ tenantId: tenantIdField });

    if (options?.debug) {
      console.log('Added tenantId field to schema with conditional validation');
    }
  }

  // Apply tenant filter to all find queries (find, findOne, findOneAndUpdate, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre(/^find/, function (this: any, next: any) {
    // Check if this model should be exempt
    if (this.model && exemptModels.has(this.model.modelName)) {
      return next();
    }

    const tenantId = tenantContext.getStore();

    // Only apply filter if there's a tenant in the context and query doesn't already have tenantId
    if (tenantId && !this.getQuery().tenantId) {
      if (options?.debug) {
        console.log(`[Query] Adding tenant filter: { tenantId: ${tenantId} }`);
      }
      this.where({ tenantId });
    }

    // If hideTenantId is true, exclude tenantId from the results
    if (options?.hideTenantId) {
      this.select('-tenantId');
    }

    next();
  });

  // Apply tenant filter to count queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre(/^count/, function (this: any, next: any) {
    // Check if this model should be exempt
    if (this.model && exemptModels.has(this.model.modelName)) {
      return next();
    }

    const tenantId = tenantContext.getStore();

    if (tenantId && !this.getQuery().tenantId) {
      this.where({ tenantId });
    }

    next();
  });

  // Apply tenant ID on document save
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre('save', function (this: any, next: any) {
    // Check if this model should be exempt
    if (this.constructor && exemptModels.has(this.constructor.modelName)) {
      if (options?.debug) {
        console.log(
          `[Save] Skipping tenantId setting for exempt model: ${this.constructor.modelName}`,
        );
      }
      return next();
    }

    const tenantId = tenantContext.getStore();
    if (options?.debug) {
      console.log(`[Save] Current tenant context: ${tenantId || 'none'}`);
    }

    if (tenantId && !this.get('tenantId')) {
      if (options?.debug) {
        console.log(`[Save] Setting tenantId to ${tenantId}`);
      }
      this.set('tenantId', tenantId);
    } else if (!tenantId) {
      if (options?.debug) {
        console.log('[Save] No tenant context found when saving document');
      }
    }

    next();
  });

  // Also apply tenant ID before validation to ensure it passes required validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre('validate', function (this: any, next: any) {
    // Skip for exempt models
    if (this.constructor && exemptModels.has(this.constructor.modelName)) {
      if (options?.debug) {
        console.log(
          `[Validate] Skipping tenant validation for exempt model: ${this.constructor.modelName}`,
        );
      }
      return next();
    }

    const tenantId = tenantContext.getStore();

    // Set tenantId if available from context and not already set
    if (tenantId && !this.get('tenantId')) {
      if (options?.debug) {
        console.log(`[Validate] Setting tenantId to ${tenantId} before validation`);
      }
      this.set('tenantId', tenantId);
    }

    next();
  });
}

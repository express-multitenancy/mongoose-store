/**
 * Mongoose Store for Express Multitenancy
 *
 * A MongoDB-based tenant storage implementation for the express-multitenancy package.
 * This package provides a MongooseStore implementation and a Mongoose plugin for
 * automatically filtering queries by tenant.
 */

// Export the MongooseStore class
export { MongooseStore } from './store';

// Export the multitenancy plugin and related types/utilities
export {
  multitenancyPlugin,
  exemptModels,
  type MultitenancyPluginOptions,
} from './mongoose-plugin';

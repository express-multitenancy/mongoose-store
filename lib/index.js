"use strict";
/**
 * Mongoose Store for Express Multitenancy
 *
 * A MongoDB-based tenant storage implementation for the express-multitenancy package.
 * This package provides a MongooseStore implementation and a Mongoose plugin for
 * automatically filtering queries by tenant.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exemptModels = exports.multitenancyPlugin = exports.MongooseStore = void 0;
// Export the MongooseStore class
var store_1 = require("./store");
Object.defineProperty(exports, "MongooseStore", { enumerable: true, get: function () { return store_1.MongooseStore; } });
// Export the multitenancy plugin and related types/utilities
var mongoose_plugin_1 = require("./mongoose-plugin");
Object.defineProperty(exports, "multitenancyPlugin", { enumerable: true, get: function () { return mongoose_plugin_1.multitenancyPlugin; } });
Object.defineProperty(exports, "exemptModels", { enumerable: true, get: function () { return mongoose_plugin_1.exemptModels; } });

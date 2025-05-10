# express-multitenancy-mongoose

<div align="center">
  
[![Build Status](https://img.shields.io/github/actions/workflow/status/express-multitenancy/express-multitenancy/main.yml)](https://github.com/express-multitenancy/express-multitenancy/actions/workflows/main.yml)
![Version](https://img.shields.io/npm/v/express-multitenancy-mongoose)
![License](https://img.shields.io/npm/l/express-multitenancy-mongoose)
![Downloads](https://img.shields.io/npm/dm/express-multitenancy-mongoose)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)
  
**A MongoDB-based tenant storage implementation for the express-multitenancy package**
  
[Getting Started](#getting-started) •
[Features](#features) •
[Installation](#installation) •
[Usage](#usage) •
[API Reference](#api-reference) •
[Advanced Usage](#advanced-usage) •
[License](#license)
  
</div>

## 🌟 Overview

@express-multitenancy/mongoose-store provides seamless integration between express-multitenancy and Mongoose, enabling automatic tenant filtering and database separation in multi-tenant applications. This package makes building MongoDB-backed multi-tenant applications simple and secure.

## ✨ Features

- **💾 MongoDB-based tenant storage** for production-ready applications
- **🔍 Automatic tenant filtering** for all Mongoose queries
- **🔐 Transparent tenant ID assignment** for new documents
- **🌐 Support for exempt models** (global resources unaffected by tenant filtering)
- **📝 TypeScript support** with full type definitions

## 📦 Installation

```bash
# Using npm
npm install express-multitenancy-mongoose mongoose express-multitenancy

# Using yarn
yarn add express-multitenancy-mongoose mongoose express-multitenancy

# Using pnpm
pnpm add express-multitenancy-mongoose mongoose express-multitenancy
```

## 🚀 Quick Start

```javascript
const express = require('express');
const mongoose = require('mongoose');
const { multitenancy, HeaderStrategy } = require('express-multitenancy');
const { MongooseStore, multitenancyPlugin } = require('express-multitenancy-mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/multitenancy-app');

// Create a tenant store
const store = new MongooseStore({
  connection: mongoose.connection
});

// Apply multitenancy plugin globally to all Mongoose schemas
mongoose.plugin(multitenancyPlugin);

const app = express();

// Apply multitenancy middleware
app.use(multitenancy({
  strategies: [new HeaderStrategy('x-tenant-id')],
  store
}));

// All Mongoose queries will now be automatically filtered by tenant
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  price: Number
  // tenantId is added automatically by the plugin
}));

app.get('/products', async (req, res) => {
  // This query will only return products for the current tenant
  const products = await Product.find();
  res.json(products);
});

app.listen(3000);
```

## 📖 API Reference

### MongooseStore

```javascript
const store = new MongooseStore(options);
```

#### Options

- `connection` (required): Mongoose database connection
- `modelName` (optional): Name for the Mongoose model (default: 'Tenant')
- `schema` (optional): Custom schema for the tenant model
- `model` (optional): Custom pre-defined Mongoose model

### multitenancyPlugin

```javascript
// Apply to a specific schema
userSchema.plugin(multitenancyPlugin, options);

// Apply globally to all schemas
mongoose.plugin(multitenancyPlugin, options);
```

#### Options

- `exemptModels` (optional): Array of model names that should be exempt from tenant filtering
- `hideTenantId` (optional): Whether to hide tenantId in the response (default: false)
- `debug` (optional): Whether to enable debug logging (default: false)

## 🔧 Advanced Usage

### Using a Custom Tenant Schema

```javascript
const mongoose = require('mongoose');
const { MongooseStore } = require('express-multitenancy-mongoose');

// Create custom tenant schema
const customTenantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  // Add custom fields
  domain: String,
  plan: { type: String, enum: ['free', 'premium', 'enterprise'] },
  createdAt: { type: Date, default: Date.now }
});

// Use the custom schema in MongooseStore
const store = new MongooseStore({
  connection: mongoose.connection,
  schema: customTenantSchema
});
```

### Exempting Models from Tenant Filtering

Some models in your application might be global and not tenant-specific (like settings or shared resources). You can exempt these models from tenant filtering:

```javascript
const { multitenancyPlugin, exemptModels } = require('express-multitenancy-mongoose');

// Add models to exempt list
exemptModels.add('GlobalSettings');
exemptModels.add('SharedResources');

// Or use the plugin options
mongoose.plugin(multitenancyPlugin, {
  exemptModels: ['GlobalSettings', 'SharedResources']
});
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/zahidcakici">Zahid Cakici</a></sub>
</div>

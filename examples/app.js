/**
 * Example application demonstrating the mongoose-store package with express-multitenancy
 */
const express = require('express');
const mongoose = require('mongoose');
const { multitenancy, HeaderStrategy } = require('express-multitenancy');
const { MongooseStore, multitenancyPlugin } = require('../lib');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/multitenancy-example')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Create a tenant store using MongooseStore
const mongooseStore = new MongooseStore({
  connection: mongoose.connection,
  modelName: 'Organization' // Optional: customize model name (default is 'Tenant')
});

// Apply the multitenancy plugin globally
mongoose.plugin(multitenancyPlugin, {
  hideTenantId: true, // Hide tenantId field in response
  debug: true // Enable debug logging
});

// Create a Product schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String
  // tenantId will be added automatically by the plugin
});

// Create the Product model
const Product = mongoose.model('Product', productSchema);

// Apply multitenancy middleware
app.use(multitenancy({
  strategies: [new HeaderStrategy('x-tenant-id')],
  store: mongooseStore,
  debug: true,
  onTenantNotFound: (req, res, next, tenantId) => {
    res.status(404).json({ 
      error: 'Tenant Not Found',
      message: `Tenant with ID '${tenantId}' does not exist`
    });
  }
}));

// Seed initial data
async function seedData() {
  try {
    // Seed tenants if none exist
    const tenantCount = await mongoose.model('Organization').countDocuments();
    if (tenantCount === 0) {
      console.log('Seeding initial tenants...');
      await mongooseStore.add({ id: 'tenant1', name: 'Acme Corporation' });
      await mongooseStore.add({ id: 'tenant2', name: 'Globex Industries' });
    }
    
    // Seed products if none exist
    const productCount = await Product.countDocuments({});
    if (productCount === 0) {
      console.log('Seeding products...');
      await Product.create([
        { name: 'Premium Widget', price: 99.99, description: 'High-quality widget', tenantId: 'tenant1' },
        { name: 'Basic Widget', price: 49.99, description: 'Standard widget', tenantId: 'tenant1' },
        { name: 'Widget Pro', price: 199.99, description: 'Professional-grade widget', tenantId: 'tenant2' },
        { name: 'Widget Lite', price: 29.99, description: 'Lightweight widget', tenantId: 'tenant2' }
      ]);
    }
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

// Routes
seedData().then(() => {
  // List all tenants
  app.get('/tenants', async (req, res) => {
    const tenants = await mongooseStore.getAll();
    res.json({ tenants });
  });

  // Get current tenant
  app.get('/tenant', (req, res) => {
    if (!req.tenant) {
      return res.status(400).json({ error: 'No Tenant Context' });
    }
    res.json({ tenant: req.tenant });
  });

  // List products for current tenant
  app.get('/products', async (req, res) => {
    try {
      // Query is automatically filtered by current tenant
      const products = await Product.find();
      res.json({ products });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a product for current tenant
  app.post('/products', async (req, res) => {
    try {
      if (!req.tenant) {
        return res.status(400).json({ error: 'No Tenant Context' });
      }
      
      const product = new Product(req.body);
      await product.save();
      res.status(201).json({ message: 'Product created', product });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('\nTest commands:');
    console.log('  List tenants: curl http://localhost:3000/tenants');
    console.log('  Get tenant1: curl -H "x-tenant-id: tenant1" http://localhost:3000/tenant');
    console.log('  List tenant1 products: curl -H "x-tenant-id: tenant1" http://localhost:3000/products');
    console.log('  Create product: curl -H "x-tenant-id: tenant1" -H "Content-Type: application/json" -X POST -d \'{"name":"New Product","price":29.99}\' http://localhost:3000/products');
  });
});
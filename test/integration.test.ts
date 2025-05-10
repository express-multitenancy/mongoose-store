import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';
import mongoose, { Schema, Document } from 'mongoose';
import { multitenancy, HeaderStrategy, tenantContext, Tenant } from 'express-multitenancy';
import { MongoTestUtils } from './utils/test-utils';
import { MongooseStore, multitenancyPlugin } from '../lib';

// Create a proper type for products
interface ProductDocument extends Document {
  name: string;
  price: number;
  description?: string;
  tenantId?: string;
}

// Add tenant property to Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant: Tenant | null;
    }
  }
}

describe('Integration Tests', () => {
  // Express app and supertest instance
  let app: express.Application;
  let request: ReturnType<typeof supertest>; // Fix type issue with supertest
  let connection: mongoose.Connection;
  let ProductModel: mongoose.Model<ProductDocument>;

  // Sample tenants
  const sampleTenants = [
    { id: 'tenant1', name: 'Tenant One' },
    { id: 'tenant2', name: 'Tenant Two' },
  ];

  // Sample products
  const sampleProducts = [
    { name: 'Product 1', price: 10, description: 'First product' },
    { name: 'Product 2', price: 20, description: 'Second product' },
    { name: 'Product 3', price: 30, description: 'Third product' },
  ];

  beforeAll(async () => {
    // Connect to the in-memory MongoDB server
    connection = await MongoTestUtils.connect();
  });

  afterAll(async () => {
    // Disconnect from the in-memory MongoDB server
    await MongoTestUtils.disconnect();
  });

  beforeEach(async () => {
    // Clear the database
    await MongoTestUtils.clearDatabase();

    // Reset express app
    app = express();
    app.use(express.json());

    // Create a tenant store
    const store = new MongooseStore({ connection });

    // Initialize with sample tenants
    for (const tenant of sampleTenants) {
      await store.add(tenant);
    }

    // Delete the model if it exists to prevent the "Cannot overwrite model" error
    if (mongoose.modelNames().includes('Product')) {
      delete mongoose.models.Product;
    }

    // Create product schema and model with multitenancy plugin
    const productSchema = new Schema({
      name: { type: String, required: true },
      price: { type: Number, required: true },
      description: String,
    });

    // Apply multitenancy plugin
    productSchema.plugin(multitenancyPlugin, { debug: false });

    // Create model
    ProductModel = connection.model<ProductDocument>('Product', productSchema);

    // Apply multitenancy middleware
    app.use(
      multitenancy({
        strategies: [new HeaderStrategy('x-tenant-id')],
        store,
      }),
    );

    // Initialize supertest
    request = supertest(app);

    // Set up routes
    setupRoutes();

    // Seed test data
    await seedData();
  });

  function setupRoutes() {
    // Get current tenant
    app.get('/tenant', (req: Request, res: Response): void => {
      // Check if tenant ID was provided but not found
      const tenantIdHeader = req.get('x-tenant-id');
      if (tenantIdHeader && !req.tenant) {
        // Tenant ID was provided but not found
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      if (!req.tenant) {
        // No tenant ID was provided
        res.status(400).json({ error: 'No tenant context' });
        return;
      }

      res.json({ tenant: req.tenant });
    });

    // Get all products for current tenant
    app.get('/products', (req: Request, res: Response): void => {
      try {
        // This query will be automatically filtered by tenant
        ProductModel.find()
          .sort({ name: 1 }) // Sort by name in ascending order
          .then(products => {
            res.json({ products });
          })
          .catch(error => {
            res
              .status(500)
              .json({ error: error instanceof Error ? error.message : 'Unknown error' });
          });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Create a product for current tenant
    app.post('/products', (req: Request, res: Response): void => {
      const product = new ProductModel(req.body);
      product
        .save()
        .then(savedProduct => {
          res.status(201).json({ message: 'Product created', product: savedProduct });
        })
        .catch(error => {
          res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        });
    });

    // Get product by ID
    app.get('/products/:id', (req: Request, res: Response): void => {
      ProductModel.findById(req.params.id)
        .then(product => {
          if (!product) {
            return res.status(404).json({ error: 'Product not found' });
          }
          res.json({ product });
        })
        .catch(error => {
          res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        });
    });

    // Error handler with proper error middleware signature
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
  }

  async function seedData() {
    // Seed products for tenant1
    await tenantContext.run('tenant1', async () => {
      await ProductModel.create([
        { ...sampleProducts[0], tenantId: 'tenant1' },
        { ...sampleProducts[1], tenantId: 'tenant1' },
      ]);
    });

    // Seed products for tenant2
    await tenantContext.run('tenant2', async () => {
      await ProductModel.create([{ ...sampleProducts[2], tenantId: 'tenant2' }]);
    });
  }

  describe('Tenant identification', () => {
    it('should identify tenant from header', async () => {
      const response = await request.get('/tenant').set('x-tenant-id', 'tenant1');

      expect(response.status).toBe(200);
      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.id).toBe('tenant1');
      expect(response.body.tenant.name).toBe('Tenant One');
    });

    it('should return 400 when no tenant is provided', async () => {
      const response = await request.get('/tenant');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No tenant context');
    });

    it('should return 404 when tenant is not found', async () => {
      const response = await request.get('/tenant').set('x-tenant-id', 'nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('Product endpoints with tenant isolation', () => {
    it('should list only products for the current tenant', async () => {
      const response = await request.get('/products').set('x-tenant-id', 'tenant1');

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.products[0].name).toBe('Product 1');
      expect(response.body.products[1].name).toBe('Product 2');
    });

    it('should show different products for different tenants', async () => {
      const response = await request.get('/products').set('x-tenant-id', 'tenant2');

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('Product 3');
    });

    it('should create a product with the correct tenant ID', async () => {
      const newProduct = {
        name: 'New Product',
        price: 99.99,
        description: 'A brand new product',
      };

      const response = await request
        .post('/products')
        .set('x-tenant-id', 'tenant1')
        .send(newProduct);

      expect(response.status).toBe(201);
      expect(response.body.product.name).toBe('New Product');
      expect(response.body.product.tenantId).toBe('tenant1');

      // Verify the product was added with the correct tenant
      const allProducts = await request.get('/products').set('x-tenant-id', 'tenant1');

      expect(allProducts.body.products).toHaveLength(3);

      // Other tenant shouldn't see it
      const otherTenantProducts = await request.get('/products').set('x-tenant-id', 'tenant2');

      expect(otherTenantProducts.body.products).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should return validation error when required fields are missing', async () => {
      const invalidProduct = {
        description: 'Missing required fields',
      };

      const response = await request
        .post('/products')
        .set('x-tenant-id', 'tenant1')
        .send(invalidProduct);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation failed');
    });
  });
});

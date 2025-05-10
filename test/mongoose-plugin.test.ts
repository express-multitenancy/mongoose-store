import mongoose, { Schema, Model, Document } from 'mongoose';
import { MongoTestUtils } from './utils/test-utils';
import { multitenancyPlugin, exemptModels } from '../lib/mongoose-plugin';
import { tenantContext } from 'express-multitenancy';

// Define document interfaces for type safety
interface ProductDocument extends Document {
  name: string;
  price: number;
  tenantId?: string;
}

interface ExemptDocument extends Document {
  title: string;
  content?: string;
  tenantId?: string;
}

interface UserDocument extends Document {
  name?: string;
  email?: string;
  tenantId?: string;
}

describe('multitenancyPlugin', () => {
  let connection: mongoose.Connection;
  let ProductModel: Model<ProductDocument>;
  let ExemptModel: Model<ExemptDocument>;
  const currentTenantId = 'tenant1';

  // Setup basic schema for testing
  const productSchema = new Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
  });

  // Setup exempt model schema
  const exemptSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String },
  });

  beforeAll(async () => {
    connection = await MongoTestUtils.connect();

    // Reset exempt models set
    exemptModels.clear();

    // Add the test exempt model to the exempt models set
    exemptModels.add('ExemptContent');
  });

  afterAll(async () => {
    await MongoTestUtils.disconnect();
  });

  beforeEach(async () => {
    await MongoTestUtils.clearDatabase();

    // Apply plugin to product schema with default options
    productSchema.plugin(multitenancyPlugin, { debug: true });

    // Apply plugin to exempt schema with exempted model
    exemptSchema.plugin(multitenancyPlugin, { debug: false });

    // Create models
    ProductModel = connection.model<ProductDocument>('Product', productSchema);
    ExemptModel = connection.model<ExemptDocument>('ExemptContent', exemptSchema);

    // Create test data
    await ProductModel.create([
      { name: 'Product 1', price: 10, tenantId: 'tenant1' },
      { name: 'Product 2', price: 20, tenantId: 'tenant1' },
      { name: 'Product 3', price: 30, tenantId: 'tenant2' },
      { name: 'Product 4', price: 40, tenantId: 'tenant2' },
    ]);

    await ExemptModel.create([
      { title: 'Exempt 1', content: 'Content 1', tenantId: 'tenant1' },
      { title: 'Exempt 2', content: 'Content 2', tenantId: 'tenant2' },
    ]);
  });

  describe('Tenant filtering', () => {
    it('should add tenantId field to schema', () => {
      // Check that tenantId was added to the schema
      expect(productSchema.path('tenantId')).toBeDefined();
      expect(productSchema.path('tenantId').instance).toBe('String');
    });

    it('should filter find queries by tenant ID', async () => {
      // Run inside tenant context
      await tenantContext.run(currentTenantId, async () => {
        const products = await ProductModel.find();

        expect(products).toHaveLength(2);
        expect(products[0].name).toBe('Product 1');
        expect(products[1].name).toBe('Product 2');
        expect(products[0].tenantId).toBe(currentTenantId);
        expect(products[1].tenantId).toBe(currentTenantId);
      });
    });

    it('should filter findOne queries by tenant ID', async () => {
      await tenantContext.run(currentTenantId, async () => {
        const product = await ProductModel.findOne({ name: 'Product 1' });

        expect(product).toBeDefined();
        expect(product?.name).toBe('Product 1');
        expect(product?.tenantId).toBe(currentTenantId);

        // Should not find products from other tenants
        const product2 = await ProductModel.findOne({ name: 'Product 3' });
        expect(product2).toBeNull();
      });
    });

    it('should apply tenant ID on save', async () => {
      await tenantContext.run(currentTenantId, async () => {
        const newProduct = new ProductModel({
          name: 'New Product',
          price: 99,
        });

        await newProduct.save();

        // Verify tenant ID was set
        expect(newProduct.tenantId).toBe(currentTenantId);

        // Verify it can be found in the filtered query
        const foundProduct = await ProductModel.findOne({ name: 'New Product' });
        expect(foundProduct).toBeDefined();
        expect(foundProduct?.tenantId).toBe(currentTenantId);
      });
    });

    it('should not apply tenant filtering outside of tenant context', async () => {
      // No tenant context, should return all products
      const allProducts = await ProductModel.find();
      expect(allProducts).toHaveLength(4);
    });

    it('should use specified tenant ID in query even outside context', async () => {
      // No tenant context, but specifying tenant ID in query
      const products = await ProductModel.find({ tenantId: 'tenant2' }).sort({ name: 1 });
      expect(products).toHaveLength(2);
      expect(products[0].name).toBe('Product 3');
      expect(products[1].name).toBe('Product 4');
    });

    it('should respect explicit tenant query over context', async () => {
      await tenantContext.run(currentTenantId, async () => {
        // Explicitly query for tenant2 products
        const tenant2Products = await ProductModel.find({ tenantId: 'tenant2' }).sort({ name: 1 });

        expect(tenant2Products).toHaveLength(2);
        expect(tenant2Products[0].name).toBe('Product 3');
        expect(tenant2Products[1].name).toBe('Product 4');
      });
    });
  });

  describe('Exempt models', () => {
    it('should not filter exempt models by tenant ID', async () => {
      await tenantContext.run(currentTenantId, async () => {
        const exemptItems = await ExemptModel.find();

        // Should return all items regardless of tenant
        expect(exemptItems).toHaveLength(2);
      });
    });

    it('should not set tenant ID on save for exempt models', async () => {
      await tenantContext.run(currentTenantId, async () => {
        const newExemptItem = new ExemptModel({
          title: 'New Exempt',
          content: 'New Exempt Content',
        });

        await newExemptItem.save();

        // tenantId should not be set for exempt models
        expect(newExemptItem.tenantId).toBeUndefined();
      });
    });

    it('should allow adding exempt models through plugin options', async () => {
      // Create a new schema with plugin options
      const bookSchema = new Schema({
        title: String,
        author: String,
      });

      // Apply plugin with options that exempt this model
      bookSchema.plugin(multitenancyPlugin, {
        exemptModels: ['Book'],
      });

      // Create the model
      const BookModel = connection.model('Book', bookSchema);

      // Create sample data
      await BookModel.create([
        { title: 'Book 1', author: 'Author 1', tenantId: 'tenant1' },
        { title: 'Book 2', author: 'Author 2', tenantId: 'tenant2' },
      ]);

      // Should not be filtered by tenant context
      await tenantContext.run(currentTenantId, async () => {
        const books = await BookModel.find();
        expect(books).toHaveLength(2);
      });
    });
  });

  describe('Plugin options', () => {
    it('should hide tenantId when hideTenantId option is true', async () => {
      // Create a schema with hideTenantId option
      const userSchema = new Schema({
        name: String,
        email: String,
      });

      userSchema.plugin(multitenancyPlugin, {
        hideTenantId: true,
      });

      const UserModel = connection.model<UserDocument>('User', userSchema);

      // Create test user
      await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
        tenantId: currentTenantId,
      });

      await tenantContext.run(currentTenantId, async () => {
        const user = await UserModel.findOne().lean();

        // Verify user is found
        expect(user).toBeDefined();
        expect(user?.name).toBe('Test User');

        // tenantId should not be included in results due to hideTenantId option
        // Using type assertion to access tenantId safely for the test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((user as any)?.tenantId).toBeUndefined();
      });
    });

    it('should work with count queries', async () => {
      await tenantContext.run(currentTenantId, async () => {
        const count = await ProductModel.countDocuments();
        expect(count).toBe(2);
      });

      await tenantContext.run('tenant2', async () => {
        const count = await ProductModel.countDocuments();
        expect(count).toBe(2);
      });
    });

    it('should not require tenantId for exempt models', async () => {
      // The schema validation should not require tenantId for exempt models
      const newExempt = new ExemptModel({
        title: 'Required Test',
        content: 'Testing required validation',
      });

      // This should not throw validation error
      await newExempt.validate();
    });
  });
});

import mongoose, { Schema } from 'mongoose';
import { MongooseStore } from '../lib/store';
import { Tenant } from 'express-multitenancy';
import { MongoTestUtils } from './utils/test-utils';

describe('MongooseStore', () => {
  // MongoDB connection
  let connection: mongoose.Connection;

  // Sample tenants for testing
  const sampleTenants: Tenant[] = [
    { id: 'tenant1', name: 'Tenant 1' },
    { id: 'tenant2', name: 'Tenant 2' },
  ];

  // Store instance to test
  let store: MongooseStore;

  beforeAll(async () => {
    connection = await MongoTestUtils.connect();
  });

  afterAll(async () => {
    await MongoTestUtils.disconnect();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await MongoTestUtils.clearDatabase();

    // Create a fresh store for each test
    store = new MongooseStore({ connection });
  });

  describe('constructor', () => {
    it('should create store with default options', () => {
      const testStore = new MongooseStore({ connection });
      expect(testStore).toBeDefined();
    });

    it('should throw error if connection is not provided', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new MongooseStore({});
      }).toThrow('MongoDB connection is required for MongooseStore');
    });

    it('should use custom model name', () => {
      const testStore = new MongooseStore({
        connection,
        modelName: 'CustomTenant',
      });
      expect(testStore).toBeDefined();
      // Verify the model was registered with mongoose
      expect(connection.models.CustomTenant).toBeDefined();
    });

    it('should use custom schema', () => {
      const customSchema = new Schema({
        id: { type: String, required: true },
        name: { type: String, required: true },
        domain: { type: String },
      });

      const testStore = new MongooseStore({
        connection,
        schema: customSchema,
        modelName: 'TenantWithCustomSchema', // Use a unique model name for this test
      });

      expect(testStore).toBeDefined();
      // Verify the model was registered with the custom schema
      expect(connection.models.TenantWithCustomSchema.schema.paths.domain).toBeDefined();
    });

    it('should use custom model', () => {
      const customSchema = new Schema({
        id: { type: String, required: true },
        name: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      });

      const CustomModel = connection.model('CustomModel', customSchema);

      const testStore = new MongooseStore({
        connection,
        model: CustomModel,
      });

      expect(testStore).toBeDefined();
    });

    it('should throw error if custom model is missing required fields', () => {
      // Create a model without the required 'id' field
      const invalidSchema = new Schema({
        name: { type: String, required: true },
      });

      // Add required Tenant fields to make TypeScript happy (but functionally will still fail)
      type PartialTenant = { name: string; id?: string };

      const InvalidModel = connection.model<PartialTenant>('InvalidModel', invalidSchema);

      expect(() => {
        // Use type assertion to bypass TypeScript error but still test the runtime error
        new MongooseStore({
          connection,
          model: InvalidModel as unknown as mongoose.Model<Tenant>,
        });
      }).toThrow('Custom tenant model must include "id" and "name" fields');
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      // Add sample tenants to the store
      for (const tenant of sampleTenants) {
        await store.add(tenant);
      }
    });

    describe('getById', () => {
      it('should return tenant by ID', async () => {
        const tenant = await store.getById('tenant1');
        expect(tenant).not.toBeNull();
        expect(tenant?.id).toBe('tenant1');
        expect(tenant?.name).toBe('Tenant 1');
      });

      it('should return null for non-existent tenant ID', async () => {
        const tenant = await store.getById('non-existent');
        expect(tenant).toBeNull();
      });
    });

    describe('getByName', () => {
      it('should return tenant by name', async () => {
        const tenant = await store.getByName('Tenant 2');
        expect(tenant).not.toBeNull();
        expect(tenant?.id).toBe('tenant2');
        expect(tenant?.name).toBe('Tenant 2');
      });

      it('should return null for non-existent tenant name', async () => {
        const tenant = await store.getByName('Non-existent Tenant');
        expect(tenant).toBeNull();
      });
    });

    describe('getAll', () => {
      it('should return all tenants', async () => {
        const tenants = await store.getAll();
        expect(tenants).toHaveLength(2);
        expect(tenants[0].id).toBe('tenant1');
        expect(tenants[1].id).toBe('tenant2');
      });
    });

    describe('add', () => {
      it('should add a new tenant', async () => {
        const newTenant: Tenant = { id: 'tenant3', name: 'Tenant 3' };

        await store.add(newTenant);

        const retrievedTenant = await store.getById('tenant3');
        expect(retrievedTenant).not.toBeNull();
        expect(retrievedTenant?.id).toBe('tenant3');
        expect(retrievedTenant?.name).toBe('Tenant 3');
      });
    });
  });

  describe('Custom tenant types', () => {
    interface CustomTenant extends Tenant {
      domain: string;
      isActive: boolean;
    }

    const customTenants: CustomTenant[] = [
      { id: 'custom1', name: 'Custom 1', domain: 'custom1.example.com', isActive: true },
      { id: 'custom2', name: 'Custom 2', domain: 'custom2.example.com', isActive: false },
    ];

    it('should handle custom tenant properties', async () => {
      const customSchema = new Schema({
        id: { type: String, required: true },
        name: { type: String, required: true },
        domain: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      });

      const customStore = new MongooseStore<CustomTenant>({
        connection,
        schema: customSchema,
        modelName: 'CustomTenantProperties', // Unique model name for this test
      });

      // Add sample custom tenants
      for (const tenant of customTenants) {
        await customStore.add(tenant);
      }

      const tenant = await customStore.getById('custom1');

      expect(tenant).not.toBeNull();
      expect(tenant?.domain).toBe('custom1.example.com');
      expect(tenant?.isActive).toBe(true);
    });

    it('should add a custom tenant', async () => {
      const customSchema = new Schema({
        id: { type: String, required: true },
        name: { type: String, required: true },
        domain: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      });

      const customStore = new MongooseStore<CustomTenant>({
        connection,
        schema: customSchema,
        modelName: 'CustomTenantAdd', // Unique model name for this test
      });

      // Add initial test tenants
      for (const tenant of customTenants) {
        await customStore.add(tenant);
      }

      const newTenant: CustomTenant = {
        id: 'custom3',
        name: 'Custom 3',
        domain: 'custom3.example.com',
        isActive: true,
      };

      await customStore.add(newTenant);

      const retrieved = await customStore.getById('custom3');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.domain).toBe('custom3.example.com');
      expect(retrieved?.isActive).toBe(true);
    });
  });
});

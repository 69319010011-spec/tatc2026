const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { saveProductImage } = require('../storage/product-images');

test('local image storage keeps the existing relative URL', async () => {
  assert.equal(await saveProductImage({ filename: 'photo.jpg' }), '/uploads/products/photo.jpg');
});

test('cloud uploads return a public URL, reject failures and clean temporary files', async () => {
  const previous = { ...process.env };
  const originalFetch = global.fetch;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'product-images-'));
  try {
    process.env.PRODUCT_IMAGE_STORAGE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
    const file = { path: path.join(dir, 'photo.jpg'), filename: 'photo.jpg', mimetype: 'image/jpeg' };
    await fs.writeFile(file.path, 'sample');
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://example.supabase.co/storage/v1/object/product-images/products/photo.jpg');
      assert.equal(options.headers.Authorization, 'Bearer test-secret');
      assert.equal(options.body.toString(), 'sample');
      return { ok: true };
    };
    assert.equal(await saveProductImage(file), 'https://example.supabase.co/storage/v1/object/public/product-images/products/photo.jpg');
    await assert.rejects(fs.access(file.path));
    await fs.writeFile(file.path, 'sample');
    global.fetch = async () => ({ ok: false, status: 403 });
    await assert.rejects(saveProductImage(file), /403/);
    await assert.rejects(fs.access(file.path));
  } finally {
    global.fetch = originalFetch;
    for (const name of ['PRODUCT_IMAGE_STORAGE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
});

const fs = require('node:fs/promises');

async function saveProductImage(file) {
  const provider = process.env.PRODUCT_IMAGE_STORAGE || 'local';
  if (provider === 'local') return `/uploads/products/${file.filename}`;
  try {
    if (provider !== 'supabase') throw new Error('Unsupported PRODUCT_IMAGE_STORAGE');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
    if (!url || !key) throw new Error('Supabase image storage is not configured');
    const objectPath = `${encodeURIComponent(bucket)}/products/${encodeURIComponent(file.filename)}`;
    const base = `${url.replace(/\/$/, '')}/storage/v1/object`;
    const response = await fetch(`${base}/${objectPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': file.mimetype },
      body: await fs.readFile(file.path),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Product image storage failed (${response.status})`);
    return `${base}/public/${objectPath}`;
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
}

module.exports = { saveProductImage };

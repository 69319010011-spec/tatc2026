const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/admin');

const protectedPaths = [
  '/dashboard',
  '/analytics/sales-daily',
  '/analytics/top-products',
  '/analytics/sales-by-category',
];

for (const path of protectedPaths) {
  for (const role of ['restocker', 'technician', 'super_admin']) {
    test(`${role} access to ${path}`, () => {
      const route = router.stack.find((layer) => layer.route?.path === path).route;
      assert.equal(route.methods.get, true);
      assert.ok(route.stack.length > 1, 'Authorization must run before the data handler');
      let nextCalled = false;
      let status;
      let body;
      const res = {
        status(code) { status = code; return this; },
        json(value) { body = value; return this; },
      };
      route.stack[0].handle({ admin: { role } }, res, () => { nextCalled = true; });
      assert.equal(nextCalled, role === 'super_admin');
      if (role !== 'super_admin') {
        assert.equal(status, 403);
        assert.deepEqual(body, { error: 'Insufficient permissions' });
      } else {
        assert.equal(status, undefined);
      }
    });
  }
}

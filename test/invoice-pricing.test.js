'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Mirrors the item fields assembled by routes/orders.js for a saved order.
function orderLine(overrides) {
  return Object.assign({
    id: 1,
    sku: 'SKU-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }, overrides || {});
}

test('invoice tax breakdown matches the HSN tax and total used for billing', function () {
  const items = [orderLine()];
  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: invoiced.subtotal, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.deepEqual(
    { gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax },
    { gstPercent: 5, lineTax: 10 }
  );
});

test('invoice interprets fractional gstRate the same way as pricing', function () {
  const items = [orderLine({ hsn: '', price: 100, qty: 1, gstRate: 0.18 })];
  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax, tax: invoiced.tax, total: invoiced.total },
    { gstPercent: 18, lineTax: 18, tax: billed.tax, total: billed.total }
  );
});

test('invoice coupon figures match the subtotal discount and GST used for billing', function () {
  const items = [orderLine({ price: 500, qty: 1 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
});

test('rendered invoice does not show a reconciliation warning when it matches the billed total', function () {
  const items = [orderLine()];
  const billed = pricing.computeTotals(items, '');
  const html = invoice.render({
    id: 1001,
    date: '01/01/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: '',
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹210\.00/);
});


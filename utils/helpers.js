const crypto = require('crypto');

/**
 * Generate a short unique payment reference ID.
 * Format: PAY-XXXXXXXX  (8 hex chars, uppercase)
 */
function generatePaymentId() {
  return 'PAY-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Format a VND amount with dot-separated thousands.
 * e.g. 75000 → "75.000 ₫"
 */
function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Calculate total amount from booking type and hours.
 * @param {'day'|'night'} type
 * @param {number} hours
 * @returns {number}
 */
function calcBookingAmount(type, hours) {
  const rates = {
    day:   parseInt(process.env.RATE_DAY   || '25000'),
    night: parseInt(process.env.RATE_NIGHT || '30000'),
  };
  return rates[type] * hours;
}

module.exports = { generatePaymentId, formatVND, calcBookingAmount };

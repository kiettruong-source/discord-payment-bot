const axios = require('axios');

// VietQR API – https://www.vietqr.io/
const VIETQR_API = 'https://api.vietqr.io/v2/generate';

/**
 * Generate a VietQR payment QR code image URL (base64 PNG).
 *
 * @param {Object} opts
 * @param {string} opts.bankId        - Bank ID / BIN code (e.g. "970422" for MB Bank)
 * @param {string} opts.accountNo     - Bank account number
 * @param {string} opts.accountName   - Account holder name
 * @param {number} opts.amount        - Amount in VND
 * @param {string} opts.description   - Payment description / transfer note
 * @returns {Promise<{qrDataURL: string, qrCode: string}>}
 */
async function generateVietQR({ bankId, accountNo, accountName, amount, description }) {
  const payload = {
    accountNo,
    accountName,
    acqId: bankId,          // Acquiring bank BIN
    amount,
    addInfo: description,   // Transfer description
    format: 'text',         // Return raw QR string
    template: 'compact2',   // QR template style
  };

  const headers = {
    'x-client-id': process.env.VIETQR_CLIENT_ID || '',
    'x-api-key':   process.env.VIETQR_API_KEY   || '',
    'Content-Type': 'application/json',
  };

  const response = await axios.post(VIETQR_API, payload, { headers });
  const data = response.data;

  if (data.code !== '00') {
    throw new Error(`VietQR API error: ${data.desc || JSON.stringify(data)}`);
  }

  return {
    qrDataURL: data.data.qrDataURL,   // base64 PNG data-URL
    qrCode:    data.data.qrCode,       // raw EMVCo QR string
  };
}

module.exports = { generateVietQR };

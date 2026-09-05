const http = require('http');
const https = require('https');

const FREIGHTCOM_CONFIG = {
    baseUrl: process.env.FREIGHTCOM_BASE_URL || 'https://external-api.freightcom.com',
    apiKey: process.env.FREIGHTCOM_API_KEY || 'jxR7xS5RzoeEe5nt6rY0fKClTG1rajkhNXTc2XHV280yYE6K8zBGO8bZQfvkpWlj',
    origin: {
        name: process.env.FREIGHTCOM_ORIGIN_NAME || 'Watani & Sons Corp',
        addressLine1: process.env.FREIGHTCOM_ORIGIN_ADDRESS_LINE_1 || '300 Greenbank Rd',
        city: process.env.FREIGHTCOM_ORIGIN_CITY || 'Ottawa',
        region: process.env.FREIGHTCOM_ORIGIN_REGION || 'ON',
        postalCode: process.env.FREIGHTCOM_ORIGIN_POSTAL_CODE || 'K2H 0B6',
        country: process.env.FREIGHTCOM_ORIGIN_COUNTRY || 'CA',
        email: process.env.FREIGHTCOM_ORIGIN_EMAIL || 'info@wataniandsons.com',
        phone: process.env.FREIGHTCOM_ORIGIN_PHONE || '+16138547777',
    },
    defaultPackage: {
        lengthCm: parseFloat(process.env.FREIGHTCOM_DEFAULT_PACKAGE_LENGTH_CM || '30'),
        widthCm: parseFloat(process.env.FREIGHTCOM_DEFAULT_PACKAGE_WIDTH_CM || '20'),
        heightCm: parseFloat(process.env.FREIGHTCOM_DEFAULT_PACKAGE_HEIGHT_CM || '20'),
    },
    flatRate: parseFloat(process.env.SHIPPING_FLAT_RATE || '30.00')
};

async function fetchRatesFromFreightcom(destination) {
    if (!FREIGHTCOM_CONFIG.apiKey) {
        return null;
    }

    const payload = JSON.stringify({
        apiKey: FREIGHTCOM_CONFIG.apiKey,
        origin: FREIGHTCOM_CONFIG.origin,
        destination: {
            addressLine1: destination.line1 || destination.address || '',
            city: destination.city || '',
            region: (destination.region || 'ON').toUpperCase(),
            postalCode: destination.postalCode || '',
            country: (destination.country || 'CA').toUpperCase()
        },
        packages: [
            {
                length: FREIGHTCOM_CONFIG.defaultPackage.lengthCm,
                width: FREIGHTCOM_CONFIG.defaultPackage.widthCm,
                height: FREIGHTCOM_CONFIG.defaultPackage.heightCm,
                weightKg: 5
            }
        ]
    });

    return new Promise((resolve) => {
        try {
            const url = new URL(`${FREIGHTCOM_CONFIG.baseUrl}/api/v1/rates`);
            const client = url.protocol === 'https:' ? https : http;

            const req = client.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    'Authorization': `Bearer ${FREIGHTCOM_CONFIG.apiKey}`
                },
                timeout: 3000
            }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = JSON.parse(data);
                            return resolve(parsed);
                        }
                    } catch (e) {}
                    resolve(null);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.write(payload);
            req.end();
        } catch {
            resolve(null);
        }
    });
}

async function getFreightcomQuotes(destination = {}, subtotal = 0) {
    const prov = (destination.region || 'ON').toUpperCase();
    let taxRate = 0.13;
    if (prov === 'QC') taxRate = 0.14975;
    else if (prov === 'BC') taxRate = 0.12;
    else if (prov === 'AB') taxRate = 0.05;

    const baseFlatRate = FREIGHTCOM_CONFIG.flatRate; // 30.00
    const standardCost = subtotal > 150 ? 0 : baseFlatRate;
    const expressCost = Math.round((baseFlatRate * 1.5) * 100) / 100; // 45.00 for express

    const liveData = await fetchRatesFromFreightcom(destination);

    if (liveData && Array.isArray(liveData.rates) && liveData.rates.length > 0) {
        return liveData.rates.map(r => ({
            serviceCode: r.serviceCode || 'FREIGHTCOM_STANDARD',
            carrierName: r.carrierName || 'Freightcom Direct',
            serviceName: r.serviceName || 'Freightcom Shipping',
            cost: typeof r.rate === 'number' ? r.rate : parseFloat(r.rate || String(standardCost)),
            etaDays: r.etaDays || 3,
            taxRate,
            taxableAmount: subtotal,
            exemptAmount: 0,
            taxAmount: Math.round((typeof r.rate === 'number' ? r.rate : standardCost) * taxRate * 100) / 100
        }));
    }

    return [
        {
            serviceCode: 'FREIGHTCOM_STANDARD',
            carrierName: 'Freightcom Direct',
            serviceName: 'Freightcom Standard Shipping',
            cost: standardCost,
            etaDays: 4,
            taxRate,
            taxableAmount: subtotal,
            exemptAmount: 0,
            taxAmount: Math.round(standardCost * taxRate * 100) / 100,
        },
        {
            serviceCode: 'FREIGHTCOM_EXPRESS',
            carrierName: 'Freightcom Express Priority',
            serviceName: 'Freightcom Express Shipping',
            cost: expressCost,
            etaDays: 2,
            taxRate,
            taxableAmount: subtotal,
            exemptAmount: 0,
            taxAmount: Math.round(expressCost * taxRate * 100) / 100,
        },
        {
            serviceCode: 'PICKUP',
            carrierName: 'Watani Hub',
            serviceName: 'Warehouse Pickup',
            cost: 0,
            etaDays: 0,
            taxRate,
            taxableAmount: 0,
            exemptAmount: 0,
            taxAmount: 0,
        }
    ];
}

module.exports = {
    FREIGHTCOM_CONFIG,
    getFreightcomQuotes
};

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
    palletSpecs: {
        widthInches: 40,
        lengthInches: 48,
        maxHeightInches: 40,
    },
    flatRate: parseFloat(process.env.SHIPPING_FLAT_RATE || '30.00')
};

/**
 * Calculates total shipment weight, item count, and estimated box count.
 * Determines whether order qualifies for Pallet Pricing (orders > 10 boxes or > 100 kg).
 */
function calculateShipmentMetrics(items = []) {
    let totalWeightGrams = 0;
    let totalQuantity = 0;

    for (const item of items) {
        const qty = item.quantity || 1;
        totalQuantity += qty;

        let itemGrams = item.weight_grams || item.weightGrams;
        if (!itemGrams) {
            const name = (item.productName || item.product_name || item.name || '').toLowerCase();
            const unit = (item.unit || '').toLowerCase();
            if (name.includes('16l') || unit.includes('16l') || name.includes('16 litre') || name.includes('16 l')) {
                itemGrams = 15500; // ~15.5 kg for 16L olive oil tin
            } else if (name.includes('3l') || unit.includes('3l')) {
                itemGrams = 3200;
            } else if (name.includes('750ml') || unit.includes('750ml')) {
                itemGrams = 1200;
            } else if (name.includes('500g') || unit.includes('500g')) {
                itemGrams = 550;
            } else if (name.includes('1kg') || unit.includes('1kg')) {
                itemGrams = 1050;
            } else {
                itemGrams = 1000;
            }
        }
        totalWeightGrams += itemGrams * qty;
    }

    const totalWeightKg = Math.round((totalWeightGrams / 1000) * 10) / 10;
    
    // Each box typically holds ~12-14kg or 4 standard consumer units
    const boxCount = Math.max(1, Math.max(Math.ceil(totalWeightKg / 14), Math.ceil(totalQuantity / 4)));

    // Pallet condition: orders >= 10 boxes OR >= 100kg qualify for Pallet Pricing.
    // If the number of packages is less than 10 boxes (and < 100kg), it goes to parcel shipping.
    const isPallet = totalWeightKg >= 100 || boxCount >= 10;

    // Every 400 kg needs 1 pallet (e.g., 400kg = 1 pallet, 401kg-800kg = 2 pallets, etc.)
    const palletCount = isPallet ? Math.max(1, Math.ceil(totalWeightKg / 400)) : 0;

    // Pallet dimensions: 40" x 48", height is order dependent, max 40"
    const calculatedHeightInches = Math.min(40, Math.max(20, Math.ceil(boxCount / 4) * 8));

    return {
        totalWeightKg,
        boxCount,
        isPallet,
        palletCount,
        palletDimensions: isPallet ? `${palletCount} Pallet${palletCount > 1 ? 's' : ''} (40"x48", 400kg max/pallet)` : null,
        palletHeightInches: isPallet ? calculatedHeightInches : null
    };
}

async function fetchRatesFromFreightcom(destination, metrics) {
    if (!FREIGHTCOM_CONFIG.apiKey) {
        return null;
    }

    const packages = metrics.isPallet
        ? Array.from({ length: metrics.palletCount || 1 }, () => ({
            type: 'PALLET',
            length: 48,
            width: 40,
            height: metrics.palletHeightInches || 40,
            weightKg: Math.max(50, Math.round(metrics.totalWeightKg / (metrics.palletCount || 1)))
        }))
        : [
            {
                type: 'PACKAGE',
                length: FREIGHTCOM_CONFIG.defaultPackage.lengthCm,
                width: FREIGHTCOM_CONFIG.defaultPackage.widthCm,
                height: FREIGHTCOM_CONFIG.defaultPackage.heightCm,
                weightKg: Math.max(2, metrics.totalWeightKg)
            }
        ];

    const payload = JSON.stringify({
        apiKey: FREIGHTCOM_CONFIG.apiKey,
        origin: FREIGHTCOM_CONFIG.origin,
        destination: {
            addressLine1: destination.line1 || destination.address || '',
            city: destination.city || '',
            region: (destination.region || destination.province || 'ON').toUpperCase(),
            postalCode: destination.postalCode || '',
            country: (destination.country || 'CA').toUpperCase()
        },
        packages
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
                timeout: 3500
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

/**
 * Calculates Freightcom shipping quotes with dynamic pallet pricing support.
 */
async function getFreightcomQuotes(destination = {}, subtotal = 0, items = []) {
    const prov = (destination.region || destination.province || 'ON').toUpperCase();
    const country = (destination.country || 'CA').toUpperCase();

    // Provincial and regional tax rates
    let taxRate = 0.13;
    if (country === 'US') {
        taxRate = 0.00;
    } else if (prov === 'QC') {
        taxRate = 0.14975;
    } else if (prov === 'BC') {
        taxRate = 0.12;
    } else if (prov === 'AB' || prov === 'NT' || prov === 'NU' || prov === 'YT') {
        taxRate = 0.05;
    } else if (prov === 'NB' || prov === 'NL' || prov === 'NS' || prov === 'PE') {
        taxRate = 0.15;
    } else if (prov === 'MB' || prov === 'SK') {
        taxRate = 0.11;
    }

    const metrics = calculateShipmentMetrics(items);
    const { totalWeightKg, boxCount, isPallet, palletCount, palletDimensions } = metrics;

    // ==========================================
    // PALLET PRICING (>= 10 boxes OR >= 100 kg)
    // Every 400 kg needs 1 pallet. Customers choose between Freightcom Skid Shipping and Flat Rate Pallet options.
    // ==========================================
    if (isPallet) {
        let flatRatePerPallet = 150.00;
        try {
            const db = require('../db');
            const { rows } = await db.query('SELECT pallet_fee FROM pallet_shipping WHERE enabled = TRUE LIMIT 1');
            if (rows.length > 0 && rows[0].pallet_fee) {
                flatRatePerPallet = parseFloat(rows[0].pallet_fee) || 150.00;
            }
        } catch {}

        const flatRateCost = Math.round(flatRatePerPallet * palletCount * 100) / 100;

        let basePalletCost = 165.00; // Ontario regional base for 40"x48" pallet
        if (country === 'US') {
            basePalletCost = 340.00;
        } else if (prov === 'QC') {
            basePalletCost = 185.00;
        } else if (prov === 'MB' || prov === 'SK') {
            basePalletCost = 235.00;
        } else if (prov === 'AB' || prov === 'BC') {
            basePalletCost = 275.00;
        } else if (prov === 'NB' || prov === 'NS' || prov === 'PE' || prov === 'NL') {
            basePalletCost = 245.00;
        }

        let freightcomSkidCost = Math.round(basePalletCost * palletCount * 100) / 100;
        let freightcomCarrier = 'Day & Ross LTL via Freightcom';

        // Check if Freightcom live rates are available
        const liveData = await fetchRatesFromFreightcom(destination, metrics);
        if (liveData && Array.isArray(liveData.rates) && liveData.rates.length > 0) {
            const first = liveData.rates[0];
            const rCost = typeof first.rate === 'number' ? first.rate : parseFloat(first.rate || '0');
            if (rCost > 0) {
                freightcomSkidCost = Math.round(rCost * 100) / 100;
                if (first.carrierName) freightcomCarrier = first.carrierName;
            }
        }

        return [
            {
                serviceCode: 'FREIGHTCOM_PALLET_LTL',
                carrierName: freightcomCarrier,
                serviceName: `Freightcom Skid Shipping (${palletCount} Skid${palletCount > 1 ? 's' : ''} / Pallet${palletCount > 1 ? 's' : ''}, ${totalWeightKg}kg)`,
                cost: freightcomSkidCost,
                etaDays: prov === 'ON' ? 2 : prov === 'QC' ? 3 : 4,
                packagingType: 'PALLET',
                palletDimensions,
                palletCount,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(freightcomSkidCost * taxRate * 100) / 100
            },
            {
                serviceCode: 'PALLET_FLAT_RATE',
                carrierName: 'Watani Logistics Flat Rate',
                serviceName: `Flat Rate Pallet Delivery ($${flatRatePerPallet}/pallet - ${palletCount} Pallet${palletCount > 1 ? 's' : ''})`,
                cost: flatRateCost,
                etaDays: prov === 'ON' ? 3 : 5,
                packagingType: 'PALLET',
                palletDimensions,
                palletCount,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(flatRateCost * taxRate * 100) / 100
            },
            {
                serviceCode: 'PICKUP',
                carrierName: 'Watani Hub (300 Greenbank Rd)',
                serviceName: 'Warehouse Pallet Pickup (Free)',
                cost: 0,
                etaDays: 0,
                packagingType: 'PALLET',
                palletDimensions,
                palletCount,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: 0,
                exemptAmount: 0,
                taxAmount: 0
            }
        ];
    }

    // ==========================================
    // STANDARD PARCEL PRICING (< 100kg and < 10 boxes)
    // ==========================================
    const liveParcelData = await fetchRatesFromFreightcom(destination, metrics);
    if (liveParcelData && Array.isArray(liveParcelData.rates) && liveParcelData.rates.length > 0) {
        return liveParcelData.rates.map(r => {
            const cost = typeof r.rate === 'number' ? r.rate : parseFloat(r.rate || '30.00');
            return {
                serviceCode: r.serviceCode || 'FREIGHTCOM_STANDARD',
                carrierName: r.carrierName || 'Freightcom Direct',
                serviceName: r.serviceName || 'Expedited Parcel Shipping',
                cost,
                etaDays: r.etaDays || 2,
                packagingType: 'PARCEL',
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(cost * taxRate * 100) / 100
            };
        });
    }

    let baseParcelCost = 22.00;
    if (country === 'US') {
        baseParcelCost = 36.00;
    } else if (prov === 'ON') {
        baseParcelCost = 18.50;
    } else if (prov === 'QC') {
        baseParcelCost = 21.00;
    } else if (prov === 'AB' || prov === 'BC') {
        baseParcelCost = 29.50;
    } else if (prov === 'MB' || prov === 'SK') {
        baseParcelCost = 26.50;
    } else if (prov === 'NB' || prov === 'NS' || prov === 'PE' || prov === 'NL') {
        baseParcelCost = 27.50;
    }

    const standardCost = Math.round(baseParcelCost * 100) / 100;
    const expressCost = Math.round((baseParcelCost + 15.00) * 100) / 100;

    return [
        {
            serviceCode: 'FREIGHTCOM_STANDARD',
            carrierName: 'Canada Post / Canpar via Freightcom',
            serviceName: 'Expedited Parcel Shipping',
            cost: standardCost,
            etaDays: prov === 'ON' ? 2 : 4,
            packagingType: 'PARCEL',
            totalWeightKg,
            boxCount,
            taxRate,
            taxableAmount: subtotal,
            exemptAmount: 0,
            taxAmount: Math.round(standardCost * taxRate * 100) / 100
        },
        {
            serviceCode: 'FREIGHTCOM_EXPRESS',
            carrierName: 'Purolator Express via Freightcom',
            serviceName: 'Express Priority Shipping',
            cost: expressCost,
            etaDays: prov === 'ON' ? 1 : 2,
            packagingType: 'PARCEL',
            totalWeightKg,
            boxCount,
            taxRate,
            taxableAmount: subtotal,
            exemptAmount: 0,
            taxAmount: Math.round(expressCost * taxRate * 100) / 100
        },
        {
            serviceCode: 'PICKUP',
            carrierName: 'Watani Hub (300 Greenbank Rd)',
            serviceName: 'Warehouse Pickup (Free)',
            cost: 0,
            etaDays: 0,
            packagingType: 'PARCEL',
            totalWeightKg,
            boxCount,
            taxRate,
            taxableAmount: 0,
            exemptAmount: 0,
            taxAmount: 0
        }
    ];
}

module.exports = {
    FREIGHTCOM_CONFIG,
    calculateShipmentMetrics,
    getFreightcomQuotes
};

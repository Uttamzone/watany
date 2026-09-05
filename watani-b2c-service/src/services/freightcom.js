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

    // Pallet condition: orders > 10 boxes OR > 100kg qualify for Pallet Pricing
    const isPallet = totalWeightKg >= 100 || boxCount >= 10;

    // Pallet dimensions: 40" x 48", height is order dependent, max 40"
    const calculatedHeightInches = Math.min(40, Math.max(20, Math.ceil(boxCount / 4) * 8));

    return {
        totalWeightKg,
        boxCount,
        isPallet,
        palletDimensions: isPallet ? `40" x 48" x ${calculatedHeightInches}" (Max 40"H)` : null,
        palletHeightInches: isPallet ? calculatedHeightInches : null
    };
}

async function fetchRatesFromFreightcom(destination, metrics) {
    if (!FREIGHTCOM_CONFIG.apiKey) {
        return null;
    }

    const packages = metrics.isPallet
        ? [
            {
                type: 'PALLET',
                length: 48,
                width: 40,
                height: metrics.palletHeightInches || 40,
                weightKg: Math.max(100, metrics.totalWeightKg)
            }
        ]
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
    const { totalWeightKg, boxCount, isPallet, palletDimensions } = metrics;

    // Try live rates from Freightcom API
    const liveData = await fetchRatesFromFreightcom(destination, metrics);
    if (liveData && Array.isArray(liveData.rates) && liveData.rates.length > 0) {
        return liveData.rates.map(r => {
            const cost = typeof r.rate === 'number' ? r.rate : parseFloat(r.rate || '30.00');
            return {
                serviceCode: r.serviceCode || (isPallet ? 'FREIGHTCOM_PALLET_LTL' : 'FREIGHTCOM_STANDARD'),
                carrierName: r.carrierName || (isPallet ? 'Day & Ross LTL via Freightcom' : 'Freightcom Direct'),
                serviceName: r.serviceName || (isPallet ? `Pallet Freight (${palletDimensions})` : 'Freightcom Shipping'),
                cost,
                etaDays: r.etaDays || (isPallet ? 3 : 2),
                packagingType: isPallet ? 'PALLET' : 'PARCEL',
                dimensions: palletDimensions,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(cost * taxRate * 100) / 100
            };
        });
    }

    // ==========================================
    // PALLET PRICING (> 10 boxes OR > 100 kg)
    // ==========================================
    if (isPallet) {
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

        // Weight surcharge if exceeding 200kg ($0.20 per kg above 200kg)
        if (totalWeightKg > 200) {
            basePalletCost += Math.round((totalWeightKg - 200) * 0.20 * 100) / 100;
        }

        const standardPalletCost = Math.round(basePalletCost * 100) / 100;
        const priorityPalletCost = Math.round(basePalletCost * 1.3 * 100) / 100;

        return [
            {
                serviceCode: 'FREIGHTCOM_PALLET_LTL',
                carrierName: 'Day & Ross LTL via Freightcom',
                serviceName: `Standard Pallet Freight (40"x48" Pallet, ${boxCount} boxes / ${totalWeightKg}kg)`,
                cost: standardPalletCost,
                etaDays: prov === 'ON' ? 2 : prov === 'QC' ? 3 : 4,
                packagingType: 'PALLET',
                palletDimensions,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(standardPalletCost * taxRate * 100) / 100
            },
            {
                serviceCode: 'FREIGHTCOM_PALLET_EXPRESS',
                carrierName: 'Manitoulin Transport via Freightcom',
                serviceName: `Priority Pallet Freight (40"x48" Pallet, ${boxCount} boxes / ${totalWeightKg}kg)`,
                cost: priorityPalletCost,
                etaDays: prov === 'ON' ? 1 : prov === 'QC' ? 2 : 3,
                packagingType: 'PALLET',
                palletDimensions,
                totalWeightKg,
                boxCount,
                taxRate,
                taxableAmount: subtotal,
                exemptAmount: 0,
                taxAmount: Math.round(priorityPalletCost * taxRate * 100) / 100
            },
            {
                serviceCode: 'PICKUP',
                carrierName: 'Watani Hub (300 Greenbank Rd)',
                serviceName: 'Warehouse Pallet Pickup (Free)',
                cost: 0,
                etaDays: 0,
                packagingType: 'PALLET',
                palletDimensions,
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

    // Free standard shipping for retail orders over $150 within ON and QC
    const standardCost = (subtotal > 150 && (prov === 'ON' || prov === 'QC') && country === 'CA')
        ? 0
        : Math.round(baseParcelCost * 100) / 100;
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

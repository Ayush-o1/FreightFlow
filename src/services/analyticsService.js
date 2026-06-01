'use strict';

const Shipment = require('../models/Shipment');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { deleteCacheByPattern, getJsonCache, setJsonCache } = require('./cacheService');

const ADMIN_ANALYTICS_CACHE_KEY = 'analytics:admin:dashboard';

const buildAdminAnalytics = async () => {
  const [
    totalShipments,
    shipmentStatusAgg,
    totalShippers,
    totalDrivers,
    revenueAgg,
    recentShipments,
  ] = await Promise.all([
    Shipment.countDocuments(),
    Shipment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'shipper' }),
    User.countDocuments({ role: 'driver' }),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Shipment.find({})
      .populate('shipper', 'name email')
      .select('_id goodsType status createdAt shipper')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const shipmentsByStatus = {
    pending: 0,
    assigned: 0,
    picked_up: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
  };

  shipmentStatusAgg.forEach(({ _id, count }) => {
    if (_id in shipmentsByStatus) shipmentsByStatus[_id] = count;
  });

  return {
    totalShipments,
    shipmentsByStatus,
    totalShippers,
    totalDrivers,
    totalRevenue: revenueAgg.length > 0 ? revenueAgg[0].total : 0,
    recentShipments,
  };
};

const getAdminAnalytics = async () => {
  const cached = await getJsonCache(ADMIN_ANALYTICS_CACHE_KEY);
  if (cached) {
    return {
      analytics: cached,
      cache: 'hit',
    };
  }

  const analytics = await buildAdminAnalytics();
  await setJsonCache(ADMIN_ANALYTICS_CACHE_KEY, analytics);

  return {
    analytics,
    cache: 'miss',
  };
};

const invalidateAnalyticsCache = () =>
  deleteCacheByPattern('analytics:*').catch(() => undefined);

module.exports = {
  ADMIN_ANALYTICS_CACHE_KEY,
  getAdminAnalytics,
  invalidateAnalyticsCache,
};

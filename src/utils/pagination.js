'use strict';

const getPagination = (query, defaults = {}) => {
  const defaultLimit = defaults.limit || 10;
  const maxLimit = defaults.maxLimit || 100;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildPaginationPayload = ({ total, page, limit, count }) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  count,
});

module.exports = {
  buildPaginationPayload,
  getPagination,
};

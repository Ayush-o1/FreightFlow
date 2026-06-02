'use strict';

const crypto = require('crypto');
const { trace } = require('@opentelemetry/api');

const REQUEST_ID_HEADER = 'X-Request-ID';

const requestId = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && incoming.trim()
    ? incoming.trim().slice(0, 128)
    : crypto.randomUUID();

  req.id = id;
  res.locals.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  trace.getActiveSpan()?.setAttribute('freightflow.request_id', id);

  next();
};

module.exports = {
  REQUEST_ID_HEADER,
  requestId,
};

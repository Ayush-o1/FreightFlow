'use strict';

const { createAndEnqueueOutboxEvent } = require('./outboxService');

const serializeUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id?.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

const queueShipmentAssignedEvent = (shipment, driver, req, { previousStatus = 'pending' } = {}) =>
  createAndEnqueueOutboxEvent({
    type: 'shipment.assigned',
    aggregateType: 'Shipment',
    aggregateId: shipment._id,
    payload: {
      shipmentId: shipment._id.toString(),
      room: `shipment_${shipment._id}`,
      socketEvents: [
        {
          name: 'driverAssigned',
          data: {
            shipmentId: shipment._id.toString(),
            driverId: driver._id.toString(),
            driverName: driver.name,
            status: 'assigned',
            message: 'A driver has been assigned to your shipment',
            timestamp: new Date(),
          },
        },
      ],
      notification: {
        type: 'shipment.assigned',
        payload: {
          shipmentId: shipment._id.toString(),
          trackingNumber: shipment.trackingNumber,
          shipper: serializeUser(shipment.shipper),
          driver: serializeUser(driver),
          previousStatus,
          newStatus: 'assigned',
        },
      },
    },
    metadata: {
      requestId: req.id,
    },
  });

const queueShipmentCreatedEvent = (shipment, req) =>
  createAndEnqueueOutboxEvent({
    type: 'shipment.created',
    aggregateType: 'Shipment',
    aggregateId: shipment._id,
    payload: {
      shipmentId: shipment._id.toString(),
      notification: {
        type: 'shipment.created',
        payload: {
          shipmentId: shipment._id.toString(),
          trackingNumber: shipment.trackingNumber,
          shipper: serializeUser(req.user),
          newStatus: 'pending',
        },
      },
    },
    metadata: {
      requestId: req.id,
    },
  });

const queueShipmentCancelledEvent = (shipment, req, { previousStatus, cancelledBy, note }) =>
  createAndEnqueueOutboxEvent({
    type: 'shipment.cancelled',
    aggregateType: 'Shipment',
    aggregateId: shipment._id,
    payload: {
      shipmentId: shipment._id.toString(),
      room: `shipment_${shipment._id}`,
      socketEvents: [
        {
          name: 'statusUpdated',
          data: {
            shipmentId: shipment._id.toString(),
            previousStatus,
            newStatus: 'cancelled',
            updatedBy: req.user.name,
            role: req.user.role,
            note,
            timestamp: new Date(),
          },
        },
      ],
      notification: {
        type: 'shipment.cancelled',
        payload: {
          shipmentId: shipment._id.toString(),
          trackingNumber: shipment.trackingNumber,
          shipper: serializeUser(shipment.shipper),
          driver: serializeUser(shipment.driver),
          cancelledBy,
          previousStatus,
          newStatus: 'cancelled',
          note,
        },
      },
    },
    metadata: {
      requestId: req.id,
    },
  });

const queueShipmentStatusEvent = (shipment, req, { previousStatus, newStatus, note }) =>
  createAndEnqueueOutboxEvent({
    type: newStatus === 'delivered' ? 'shipment.delivered' : 'shipment.status_updated',
    aggregateType: 'Shipment',
    aggregateId: shipment._id,
    payload: {
      shipmentId: shipment._id.toString(),
      room: `shipment_${shipment._id}`,
      socketEvents: [
        {
          name: 'statusUpdated',
          data: {
            shipmentId: shipment._id.toString(),
            previousStatus,
            newStatus,
            updatedBy: req.user.name,
            role: req.user.role,
            note,
            timestamp: new Date(),
          },
        },
        ...(newStatus === 'delivered'
          ? [
              {
                name: 'shipmentDelivered',
                data: {
                  shipmentId: shipment._id.toString(),
                  message: 'Your shipment has been delivered',
                  timestamp: new Date(),
                },
              },
            ]
          : []),
      ],
      notification: {
        type: newStatus === 'delivered' ? 'shipment.delivered' : 'shipment.status_updated',
        payload: {
          shipmentId: shipment._id.toString(),
          trackingNumber: shipment.trackingNumber,
          shipper: serializeUser(shipment.shipper),
          driver: serializeUser(shipment.driver),
          previousStatus,
          newStatus,
          note,
        },
      },
    },
    metadata: {
      requestId: req.id,
    },
  });

const queueUserStatusNotification = (user, req) =>
  createAndEnqueueOutboxEvent({
    type: user.isActive ? 'user.activated' : 'user.deactivated',
    aggregateType: 'User',
    aggregateId: user._id,
    payload: {
      notification: {
        type: user.isActive ? 'user.activated' : 'user.deactivated',
        payload: {
          user: serializeUser(user),
          isActive: user.isActive,
          updatedBy: serializeUser(req.user),
        },
      },
    },
    metadata: {
      requestId: req.id,
    },
  });

module.exports = {
  queueShipmentAssignedEvent,
  queueShipmentCreatedEvent,
  queueShipmentCancelledEvent,
  queueShipmentStatusEvent,
  queueUserStatusNotification,
};

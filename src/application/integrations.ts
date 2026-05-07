import {
  PaymentAuthorizationError,
  ShipmentReservationError,
} from "../domain/errors";

export interface PaymentGateway {
  authorize(orderId: string, amountUnits: number): string;
}

export interface ShipmentGateway {
  reserve(orderId: string): string;
}

export class FakePaymentGateway implements PaymentGateway {
  constructor(private readonly shouldFail = false) {}

  authorize(orderId: string, amountUnits: number): string {
    if (this.shouldFail) {
      throw new PaymentAuthorizationError(`Payment auth failed for ${orderId}`);
    }
    return `pay_${orderId}_${amountUnits}`;
  }
}

export class FakeShipmentGateway implements ShipmentGateway {
  constructor(private readonly shouldFail = false) {}

  reserve(orderId: string): string {
    if (this.shouldFail) {
      throw new ShipmentReservationError(`Shipment reservation failed for ${orderId}`);
    }
    return `ship_${orderId}`;
  }
}

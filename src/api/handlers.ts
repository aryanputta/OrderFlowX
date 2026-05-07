import { CheckoutService } from "../application/checkoutService";
import { CheckoutRequest } from "../application/checkoutTypes";
import { ConflictError, InsufficientInventoryError, ValidationError } from "../domain/errors";

export class ApiHandlers {
  constructor(private readonly checkoutService: CheckoutService) {}

  postCheckout(body: CheckoutRequest): { statusCode: number; body: unknown } {
    try {
      const order = this.checkoutService.checkout(body);
      return { statusCode: 201, body: order };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { statusCode: 400, body: { message: error.message } };
      }
      if (error instanceof InsufficientInventoryError) {
        return { statusCode: 409, body: { message: error.message } };
      }
      if (error instanceof ConflictError) {
        return { statusCode: 409, body: { message: error.message } };
      }
      throw error;
    }
  }

  postRepair(orderId: string, reason: string): { statusCode: number; body: unknown } {
    try {
      const order = this.checkoutService.requestRepair(orderId, reason);
      return { statusCode: 202, body: order };
    } catch (error) {
      if (error instanceof ConflictError) {
        return { statusCode: 404, body: { message: error.message } };
      }
      throw error;
    }
  }
}

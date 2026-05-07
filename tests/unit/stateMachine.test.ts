import { assertTransition } from "../../src/domain/stateMachine";

test("valid transitions do not throw", () => {
  expect(() => assertTransition("PENDING", "INVENTORY_RESERVED")).not.toThrow();
});

test("invalid transitions throw conflict", () => {
  expect(() => assertTransition("CONFIRMED", "PENDING")).toThrow();
});

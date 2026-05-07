import { createHash } from "crypto";

export const hashRequest = (value: unknown): string => {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
};

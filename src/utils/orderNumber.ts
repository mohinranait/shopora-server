import { randomInt } from "node:crypto";

// No 0/O/1/I so numbers are easy to read out over the phone
const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generate human-readable unique order numbers
 * e.g. SHO-20261018-7KX4QM (32^6 ≈ 1 billion combinations per day)
 */
export const generateOrderNumber = (prefix = "SHO"): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `${prefix}-${year}${month}${day}-${code}`;
};

/**
 * Generate sub-order number for multi-vendor splitting
 * e.g. SHO-20261018-8472-V1
 */
export const generateSubOrderNumber = (
  mainOrderNumber: string,
  vendorIndex: number
): string => {
  return `${mainOrderNumber}-V${vendorIndex}`;
};

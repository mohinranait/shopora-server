/**
 * Generate human-readable unique order numbers
 * e.g. SHO-20261018-8472
 */
export const generateOrderNumber = (prefix = "SHO"): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}${month}${day}-${random}`;
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

import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";

/**
 * Create a new global attribute (e.g., Color, Size, Storage, Material)
 * with optional initial values
 */
export const createAttribute = async (payload: {
  name: string;
  type?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  values?: Array<{ value: string; colorCode?: string; displayOrder?: number }>;
}) => {
  let slug = slugify(payload.name);
  const existing = await db.orm.public.Attribute.where({ slug }).first();
  if (existing) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  return await db.transaction(async (tx) => {
    const attribute = await tx.orm.public.Attribute.create({
      name: payload.name,
      slug,
      type: payload.type || "SELECT",
      description: payload.description ?? null,
      displayOrder: payload.displayOrder || 0,
      isActive: payload.isActive !== false,
    });

    const createdValues: any[] = [];
    if (Array.isArray(payload.values) && payload.values.length > 0) {
      for (const val of payload.values) {
        const newVal = await tx.orm.public.AttributeValue.create({
          attributeId: attribute.id,
          value: val.value,
          colorCode: val.colorCode ?? null,
          displayOrder: val.displayOrder || 0,
        });
        createdValues.push(newVal);
      }
    }

    return {
      ...attribute,
      values: createdValues,
    };
  });
};

/**
 * Get all attributes with their values
 */
export const getAllAttributes = async (includeInactive = false) => {
  let query = db.orm.public.Attribute;
  if (!includeInactive) {
    query = query.where({ isActive: true });
  }

  const attributes = await query.orderBy((a) => a.displayOrder.asc()).all();

  return await Promise.all(
    attributes.map(async (attr) => {
      const values = await db.orm.public.AttributeValue
        .where({ attributeId: attr.id })
        .orderBy((v) => v.displayOrder.asc())
        .all();
      return {
        ...attr,
        values,
      };
    })
  );
};

/**
 * Get single attribute with its values by ID
 */
export const getAttributeById = async (id: string) => {
  const attribute = await db.orm.public.Attribute.where({ id }).first();
  if (!attribute) {
    throw new AppError("Attribute not found", 404);
  }

  const values = await db.orm.public.AttributeValue
    .where({ attributeId: id })
    .orderBy((v) => v.displayOrder.asc())
    .all();

  return {
    ...attribute,
    values,
  };
};

/**
 * Update an existing attribute
 */
export const updateAttribute = async (
  id: string,
  payload: {
    name?: string;
    type?: string;
    description?: string;
    displayOrder?: number;
    isActive?: boolean;
  }
) => {
  const existing = await db.orm.public.Attribute.where({ id }).first();
  if (!existing) {
    throw new AppError("Attribute not found", 404);
  }

  const updateData: any = {};
  if (payload.name) {
    updateData.name = payload.name;
    updateData.slug = slugify(payload.name);
  }
  if (payload.type !== undefined) updateData.type = payload.type;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

  const updated = await db.orm.public.Attribute.where({ id }).update(updateData);
  const values = await db.orm.public.AttributeValue
    .where({ attributeId: id })
    .orderBy((v) => v.displayOrder.asc())
    .all();

  return {
    ...updated,
    values,
  };
};

/**
 * Delete an attribute and its associated values
 */
export const deleteAttribute = async (id: string) => {
  const existing = await db.orm.public.Attribute.where({ id }).first();
  if (!existing) {
    throw new AppError("Attribute not found", 404);
  }

  await db.orm.public.Attribute.where({ id }).delete();
  return { message: "Attribute deleted successfully", id };
};

/**
 * Add a new value to an attribute
 */
export const createAttributeValue = async (
  attributeId: string,
  payload: { value: string; colorCode?: string; displayOrder?: number }
) => {
  const attribute = await db.orm.public.Attribute.where({ id: attributeId }).first();
  if (!attribute) {
    throw new AppError("Attribute not found", 404);
  }

  return await db.orm.public.AttributeValue.create({
    attributeId,
    value: payload.value,
    colorCode: payload.colorCode ?? null,
    displayOrder: payload.displayOrder || 0,
  });
};

/**
 * Update an attribute value
 */
export const updateAttributeValue = async (
  valueId: string,
  payload: { value?: string; colorCode?: string; displayOrder?: number }
) => {
  const existing = await db.orm.public.AttributeValue.where({ id: valueId }).first();
  if (!existing) {
    throw new AppError("Attribute value not found", 404);
  }

  const updateData: any = {};
  if (payload.value !== undefined) updateData.value = payload.value;
  if (payload.colorCode !== undefined) updateData.colorCode = payload.colorCode;
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;

  return await db.orm.public.AttributeValue.where({ id: valueId }).update(updateData);
};

/**
 * Delete an attribute value
 */
export const deleteAttributeValue = async (valueId: string) => {
  const existing = await db.orm.public.AttributeValue.where({ id: valueId }).first();
  if (!existing) {
    throw new AppError("Attribute value not found", 404);
  }

  await db.orm.public.AttributeValue.where({ id: valueId }).delete();
  return { message: "Attribute value deleted successfully", valueId };
};

/**
 * Cartesian Product Variant Combination Generator
 * Generates all multiplication rows when merchant selects attributes and clicks "Generate"
 */
export const generateVariantCombinations = async (payload: {
  attributes: Array<{ attributeId: string; valueIds: string[] }>;
}) => {
  if (!payload.attributes || payload.attributes.length === 0) {
    throw new AppError("At least one attribute is required to generate combinations", 400);
  }

  // Load and validate attributes and their values
  const loadedAttributes: Array<{
    attribute: any;
    values: any[];
  }> = [];

  for (const item of payload.attributes) {
    const attribute = await db.orm.public.Attribute.where({ id: item.attributeId }).first();
    if (!attribute) {
      throw new AppError(`Attribute with id ${item.attributeId} not found`, 404);
    }

    const values: any[] = [];
    for (const valId of item.valueIds) {
      const val = await db.orm.public.AttributeValue
        .where({ id: valId })
        .where({ attributeId: attribute.id })
        .first();
      if (!val) {
        throw new AppError(`Attribute value with id ${valId} not found on attribute "${attribute.name}"`, 404);
      }
      values.push(val);
    }

    if (values.length > 0) {
      loadedAttributes.push({ attribute, values });
    }
  }

  if (loadedAttributes.length === 0) {
    return [];
  }

  // Helper function: Cartesian product generator
  const cartesian = <T>(arrays: T[][]): T[][] => {
    return arrays.reduce<T[][]>(
      (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
      [[]]
    );
  };

  // Extract array of value arrays for Cartesian product
  const valueArrays = loadedAttributes.map((attr) =>
    attr.values.map((v) => ({
      attributeId: attr.attribute.id,
      attributeName: attr.attribute.name,
      valueId: v.id,
      value: v.value,
      colorCode: v.colorCode,
    }))
  );

  const combinations = cartesian(valueArrays);

  // Map into ready-to-use variant templates for the UI table
  const seenSuffixes = new Map<string, number>();

  const generatedRows = combinations.map((combo, index) => {
    const titleParts = combo.map((c) => c.value);
    const title = titleParts.join(" / ");
    
    // Create clean, unique SKU suffix e.g. "JETBLA-M", "TITBLK-M", "TITGRA-M"
    let baseSuffix = combo
      .map((c) => {
        const words = c.value.trim().split(/\s+/);
        if (words.length > 1) {
          return words.map((w: string) => w.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3)).join("").toUpperCase();
        }
        return c.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
      })
      .join("-");

    const occurrence = seenSuffixes.get(baseSuffix) || 0;
    seenSuffixes.set(baseSuffix, occurrence + 1);
    const skuSuffix = occurrence > 0 ? `${baseSuffix}-${occurrence + 1}` : baseSuffix;

    const attributeValueIds = combo.map((c) => c.valueId);

    // Dictionary format: { "Color": "Red", "Size": "XL" }
    const attributesDict: Record<string, string> = {};
    for (const c of combo) {
      attributesDict[c.attributeName] = c.value;
    }

    return {
      index: index + 1,
      title,
      suggestedSkuSuffix: skuSuffix,
      attributeValueIds,
      attributes: attributesDict,
      combinationDetails: combo,
      price: 0,
      comparePrice: null,
      costPrice: null,
      stock: 0,
      lowStockThreshold: 5,
      isDefault: index === 0,
    };
  });

  return {
    totalCombinations: generatedRows.length,
    selectedAttributesCount: loadedAttributes.length,
    variants: generatedRows,
  };
};

export const AttributeService = {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  generateVariantCombinations,
};

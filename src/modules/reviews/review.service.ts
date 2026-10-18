import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Add or update a review for a product
 */
export const createReview = async (
  userId: number,
  payload: {
    productId: number;
    rating: number;
    title?: string;
    comment: string;
    images?: string[];
  }
) => {
  const product = await db.orm.public.Product.where({ id: payload.productId }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  // Check if user already reviewed this product
  const existingReview = await db.orm.public.ProductReview
    .where({ productId: payload.productId })
    .where({ userId })
    .first();

  if (existingReview) {
    throw new AppError("You have already reviewed this product. You can update your existing review.", 400);
  }

  // Check if verified purchase
  const purchasedItem = await db.orm.public.OrderItem
    .where({ productId: payload.productId })
    .all();

  let isVerifiedPurchase = false;
  for (const item of purchasedItem) {
    const order = await db.orm.public.Order.where({ id: item.orderId }).first();
    if (order && order.userId === userId && order.paymentStatus === "PAID") {
      isVerifiedPurchase = true;
      break;
    }
  }

  // Create review
  const review = await db.orm.public.ProductReview.create({
    productId: payload.productId,
    userId,
    rating: payload.rating,
    title: payload.title ?? null,
    comment: payload.comment,
    images: payload.images || [],
    isVerifiedPurchase,
    isApproved: true, // Default approved or moderated
  });

  // Recalculate average rating for product
  const allReviews = await db.orm.public.ProductReview
    .where({ productId: payload.productId })
    .where({ isApproved: true })
    .all();

  const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const ratingAverage = Number((totalRating / allReviews.length).toFixed(1));

  await db.orm.public.Product.where({ id: payload.productId }).update({
    ratingAverage,
    ratingCount: allReviews.length,
  });

  return review;
};

/**
 * Get all reviews for a product
 */
export const getProductReviews = async (productId: number) => {
  const reviews = await db.orm.public.ProductReview
    .where({ productId })
    .where({ isApproved: true })
    .orderBy((r) => r.createdAt.desc())
    .all();

  const populated = await Promise.all(
    reviews.map(async (rev) => {
      const user = await db.orm.public.User.where({ id: rev.userId }).first();
      return {
        ...rev,
        user: user
          ? {
              id: user.id,
              name: user.name,
              avatar: user.avatar,
            }
          : null,
      };
    })
  );

  return populated;
};

/**
 * Admin: Moderate review (Approve / Reject / Delete)
 */
export const adminModerateReview = async (reviewId: number, isApproved: boolean) => {
  const review = await db.orm.public.ProductReview.where({ id: reviewId }).first();
  if (!review) {
    throw new AppError("Review not found", 404);
  }

  const updated = await db.orm.public.ProductReview.where({ id: reviewId }).update({
    isApproved,
  });

  // Recalculate product rating average
  const allReviews = await db.orm.public.ProductReview
    .where({ productId: review.productId })
    .where({ isApproved: true })
    .all();

  const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const ratingAverage = allReviews.length > 0 ? Number((totalRating / allReviews.length).toFixed(1)) : 0.0;

  await db.orm.public.Product.where({ id: review.productId }).update({
    ratingAverage,
    ratingCount: allReviews.length,
  });

  return updated;
};

export const ReviewService = {
  createReview,
  getProductReviews,
  adminModerateReview,
};

import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { USER_ROLES } from "../../constants/index.ts";

export const getQuestionsByProduct = async (productId: string) => {
  const questions = await db.orm.public.ProductQuestion
    .where({ productId, isApproved: true })
    .orderBy((q) => q.createdAt.desc())
    .all();

  if (questions.length === 0) return [];

  const userIds = [...new Set([
    ...questions.map((q) => q.userId),
    ...questions.map((q) => q.answeredBy).filter((id): id is string => typeof id === "string" && Boolean(id)),
  ])];

  const users = userIds.length
    ? await db.orm.public.User.where((u) => u.id.in(userIds)).select("id", "name", "role", "avatarId").all()
    : [];

  const avatarIds = users.map((u: any) => u.avatarId).filter((id): id is string => typeof id === "string" && Boolean(id));
  const useMedias = avatarIds.length ? await db.orm.public.UseMedia.where((um) => um.id.in(avatarIds)).all() : [];
  const mediaIds = useMedias.map((um) => um.mediaId);
  const medias = mediaIds.length ? await db.orm.public.Media.where((m) => m.id.in(mediaIds)).all() : [];
  const mediaMap = new Map(medias.map((m) => [m.id, m.url]));
  const avatarUrlMap = new Map(useMedias.map((um) => [um.id, mediaMap.get(um.mediaId) ?? null]));

  const userMap = new Map(users.map((u: any) => [
    u.id,
    {
      id: u.id,
      name: u.name,
      role: u.role,
      avatar: u.avatarId ? avatarUrlMap.get(u.avatarId) ?? null : null,
    },
  ]));

  return questions.map((q) => ({
    ...q,
    user: userMap.get(q.userId) || { id: q.userId, name: "Customer", role: "CUSTOMER", avatar: null },
    answeredByUser: q.answeredBy ? userMap.get(q.answeredBy) || null : null,
  }));
};

export const askQuestion = async (userId: string, payload: { productId: string; question: string }) => {
  const product = await db.orm.public.Product.where({ id: payload.productId }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const newQuestion = await db.orm.public.ProductQuestion.create({
    productId: payload.productId,
    userId,
    question: payload.question.trim(),
    isApproved: true,
  });

  // Notify the seller or admin
  if (product.sellerId) {
    const seller = await db.orm.public.SellerProfile.where({ id: product.sellerId }).first();
    if (seller) {
      await db.orm.public.Notification.create({
        userId: seller.userId,
        title: `New Question on ${product.name}`,
        message: `A customer asked: "${payload.question.slice(0, 100)}..."`,
        type: "ORDER",
        link: `/seller/products/${product.id}/edit`,
      });
    }
  }

  return newQuestion;
};

export const answerQuestion = async (
  questionId: string,
  user: { id: string; role: string; sellerId?: string | null },
  payload: { answer: string }
) => {
  const question = await db.orm.public.ProductQuestion.where({ id: questionId }).first();
  if (!question) {
    throw new AppError("Question not found", 404);
  }

  const product = await db.orm.public.Product.where({ id: question.productId }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  // Permission check: Admin or Seller who owns the product
  const isAdmin = user.role === USER_ROLES.ADMIN;
  let isOwnerSeller = false;

  if (user.role === USER_ROLES.SELLER) {
    let resolvedSellerId = user.sellerId;
    if (!resolvedSellerId) {
      const sellerProfile = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
      resolvedSellerId = sellerProfile ? sellerProfile.id : null;
    }
    isOwnerSeller = Boolean(resolvedSellerId && product.sellerId && resolvedSellerId === product.sellerId);
  }

  if (!isAdmin && !isOwnerSeller) {
    throw new AppError("Forbidden: Only the verified merchant of this product or platform admin can answer", 403);
  }

  const updated = await db.orm.public.ProductQuestion.where({ id: questionId }).update({
    answer: payload.answer.trim(),
    answeredBy: user.id,
    answeredAt: new Date().toISOString(),
  });

  // Notify the customer that their question was answered
  await db.orm.public.Notification.create({
    userId: question.userId,
    title: `Your question on ${product.name} was answered!`,
    message: `${user.role === USER_ROLES.ADMIN ? "Shopora Support" : "The Seller"} answered: "${payload.answer.slice(0, 100)}..."`,
    type: "ORDER",
    link: `/products/${product.slug}`,
  });

  return updated;
};

export const deleteQuestion = async (
  questionId: string,
  user: { id: string; role: string; sellerId?: string | null }
) => {
  const question = await db.orm.public.ProductQuestion.where({ id: questionId }).first();
  if (!question) {
    throw new AppError("Question not found", 404);
  }

  const isAdmin = user.role === USER_ROLES.ADMIN;
  const isAuthor = question.userId === user.id;

  if (!isAdmin && !isAuthor) {
    throw new AppError("Forbidden: You cannot delete this question", 403);
  }

  return await db.orm.public.ProductQuestion.where({ id: questionId }).delete();
};

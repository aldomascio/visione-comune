"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CreateNewsPostUseCase,
  DuplicateNewsPostSlugError,
  NewsPostValidationError,
  UpdateNewsPostUseCase,
  mapNewsPostErrorToMessage
} from "@/modules/news/application/manage-news-posts";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import { initialNewsPostActionState, type NewsPostActionState } from "./form-state";

export async function createNewsPostAction(
  _previousState: NewsPostActionState,
  formData: FormData
): Promise<NewsPostActionState> {
  await requireActiveAdmin();

  const values = readNewsPostFormValues(formData);
  let connection;
  let redirectTo: string | null = null;

  try {
    connection = createDatabaseConnection();
    const createdPost = await new CreateNewsPostUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute(values);

    revalidateNewsPaths(createdPost.slug);
    redirectTo = `/admin/notizie?created=1`;
  } catch (error) {
    if (!(error instanceof NewsPostValidationError) && !(error instanceof DuplicateNewsPostSlugError)) {
      console.error("Unable to create news post", error);
    }

    return {
      status: "error",
      message: mapNewsPostErrorToMessage(error),
      fieldErrors: getFieldErrors(error),
      values
    };
  } finally {
    await connection?.close();
  }

  if (redirectTo) {
    redirect(redirectTo);
  }

  return initialNewsPostActionState;
}

export async function updateNewsPostAction(
  _previousState: NewsPostActionState,
  formData: FormData
): Promise<NewsPostActionState> {
  await requireActiveAdmin();

  const id = getFormValue(formData, "id");
  const previousSlug = getFormValue(formData, "previousSlug");
  const values = readNewsPostFormValues(formData);
  let connection;
  let redirectTo: string | null = null;

  try {
    connection = createDatabaseConnection();
    const updatedPost = await new UpdateNewsPostUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute({ id, ...values });

    revalidateNewsPaths(updatedPost.slug);
    if (previousSlug && previousSlug !== updatedPost.slug) {
      revalidateNewsPaths(previousSlug);
    }
    redirectTo = `/admin/notizie?updated=1`;
  } catch (error) {
    if (!(error instanceof NewsPostValidationError) && !(error instanceof DuplicateNewsPostSlugError)) {
      console.error("Unable to update news post", error);
    }

    return {
      status: "error",
      message: mapNewsPostErrorToMessage(error),
      fieldErrors: getFieldErrors(error),
      values
    };
  } finally {
    await connection?.close();
  }

  if (redirectTo) {
    redirect(redirectTo);
  }

  return initialNewsPostActionState;
}

function readNewsPostFormValues(formData: FormData): NewsPostActionState["values"] {
  return {
    title: getFormValue(formData, "title"),
    slug: getFormValue(formData, "slug"),
    excerpt: getFormValue(formData, "excerpt"),
    featuredImageUrl: getFormValue(formData, "featuredImageUrl"),
    featuredImageAlt: getFormValue(formData, "featuredImageAlt"),
    content: getFormValue(formData, "content"),
    contentJson: getFormValue(formData, "contentJson"),
    status: getFormValue(formData, "status")
  };
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getFieldErrors(error: unknown): NewsPostActionState["fieldErrors"] {
  if (error instanceof NewsPostValidationError) {
    return error.fieldErrors;
  }

  if (error instanceof DuplicateNewsPostSlugError) {
    return { slug: "Questo slug e gia usato da un'altra notizia." };
  }

  return {};
}

function revalidateNewsPaths(slug: string): void {
  revalidatePath("/admin/notizie");
  revalidatePath("/notizie");
  revalidatePath(`/notizie/${slug}`);
}

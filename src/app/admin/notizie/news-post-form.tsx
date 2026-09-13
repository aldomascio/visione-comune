"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { NewsPostDetails } from "@/modules/news/application/news-post-repository";
import { normalizeNewsPostSlug } from "@/modules/news/application/manage-news-posts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/shared/ui";
import type { NewsPostActionState } from "./form-state";

type NewsPostFormProps = {
  mode: "create" | "edit";
  initialState: NewsPostActionState;
  action: (previousState: NewsPostActionState, formData: FormData) => Promise<NewsPostActionState>;
  post?: NewsPostDetails;
};

export function NewsPostForm({ action, initialState, mode, post }: NewsPostFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [title, setTitle] = useState(state.values.title);
  const [slug, setSlug] = useState(state.values.slug);
  const [slugEdited, setSlugEdited] = useState(mode === "edit" || Boolean(state.values.slug));
  const normalizedSlugPreview = useMemo(() => normalizeNewsPostSlug(title), [title]);
  const formTitle = mode === "create" ? "Nuova notizia" : "Modifica notizia";
  const description = mode === "create"
    ? "Crea una notizia e scegli se salvarla come bozza o pubblicarla subito."
    : "Aggiorna testo, slug e stato della notizia.";

  return (
    <Card aria-labelledby="news-post-form-title">
      <CardHeader>
        <CardTitle id="news-post-form-title">{formTitle}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          {post ? <input name="id" type="hidden" value={post.id} /> : null}
          {post ? <input name="previousSlug" type="hidden" value={post.slug} /> : null}

          {state.status === "error" && state.message ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">
              {state.message}
            </div>
          ) : null}

          <Field htmlFor="title" label="Titolo" hint="Titolo pubblico della notizia.">
            <Input
              aria-describedby={state.fieldErrors.title ? "title-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.title)}
              id="title"
              maxLength={180}
              name="title"
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                if (!slugEdited) {
                  setSlug(normalizeNewsPostSlug(nextTitle));
                }
              }}
              required
              value={title}
            />
            {state.fieldErrors.title ? <p className="text-sm font-medium text-destructive" id="title-error">{state.fieldErrors.title}</p> : null}
          </Field>

          <Field
            htmlFor="slug"
            label="Slug"
            hint={mode === "create" && !slugEdited && normalizedSlugPreview ? `Proposta automatica: ${normalizedSlugPreview}` : "Usa lettere minuscole, numeri e trattini."}
          >
            <Input
              aria-describedby={state.fieldErrors.slug ? "slug-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.slug)}
              id="slug"
              maxLength={160}
              name="slug"
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              required
              value={slug}
            />
            {state.fieldErrors.slug ? <p className="text-sm font-medium text-destructive" id="slug-error">{state.fieldErrors.slug}</p> : null}
          </Field>

          <Field htmlFor="excerpt" label="Estratto" hint="Opzionale. Viene mostrato nella lista pubblica.">
            <Textarea
              aria-describedby={state.fieldErrors.excerpt ? "excerpt-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.excerpt)}
              id="excerpt"
              maxLength={320}
              name="excerpt"
              rows={3}
              defaultValue={state.values.excerpt}
            />
            {state.fieldErrors.excerpt ? <p className="text-sm font-medium text-destructive" id="excerpt-error">{state.fieldErrors.excerpt}</p> : null}
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field htmlFor="featuredImageUrl" label="Immagine in evidenza" hint="Opzionale. Usa un percorso locale da public, ad esempio /news/esempio.svg.">
              <Input
                aria-describedby={state.fieldErrors.featuredImageUrl ? "featured-image-url-error" : undefined}
                aria-invalid={Boolean(state.fieldErrors.featuredImageUrl)}
                id="featuredImageUrl"
                maxLength={500}
                name="featuredImageUrl"
                defaultValue={state.values.featuredImageUrl}
              />
              {state.fieldErrors.featuredImageUrl ? <p className="text-sm font-medium text-destructive" id="featured-image-url-error">{state.fieldErrors.featuredImageUrl}</p> : null}
            </Field>

            <Field htmlFor="featuredImageAlt" label="Testo alternativo immagine" hint="Obbligatorio se imposti un'immagine.">
              <Input
                aria-describedby={state.fieldErrors.featuredImageAlt ? "featured-image-alt-error" : undefined}
                aria-invalid={Boolean(state.fieldErrors.featuredImageAlt)}
                id="featuredImageAlt"
                maxLength={180}
                name="featuredImageAlt"
                defaultValue={state.values.featuredImageAlt}
              />
              {state.fieldErrors.featuredImageAlt ? <p className="text-sm font-medium text-destructive" id="featured-image-alt-error">{state.fieldErrors.featuredImageAlt}</p> : null}
            </Field>
          </div>

          <Field htmlFor="content" label="Contenuto" hint="Testo semplice. Non viene interpretato come HTML.">
            <Textarea
              aria-describedby={state.fieldErrors.content ? "content-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.content)}
              id="content"
              maxLength={12000}
              name="content"
              required
              rows={12}
              defaultValue={state.values.content}
            />
            {state.fieldErrors.content ? <p className="text-sm font-medium text-destructive" id="content-error">{state.fieldErrors.content}</p> : null}
          </Field>

          <Field htmlFor="status" label="Stato" hint="Le bozze non sono visibili pubblicamente.">
            <Select
              aria-describedby={state.fieldErrors.status ? "status-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.status)}
              id="status"
              name="status"
              required
              defaultValue={state.values.status}
            >
              <option value="draft">Bozza</option>
              <option value="published">Pubblicata</option>
            </Select>
            {state.fieldErrors.status ? <p className="text-sm font-medium text-destructive" id="status-error">{state.fieldErrors.status}</p> : null}
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button disabled={pending} type="submit">
              {pending ? "Salvataggio..." : mode === "create" ? "Salva notizia" : "Salva modifiche"}
            </Button>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/admin/notizie"
            >
              Annulla
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

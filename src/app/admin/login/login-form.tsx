"use client";

import { useActionState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/shared/ui";
import { adminLoginAction, type AdminLoginActionState } from "./actions";

const initialState: AdminLoginActionState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, initialState);

  return (
    <Card aria-labelledby="admin-login-title">
      <CardHeader>
        <CardTitle id="admin-login-title">Accesso amministratori</CardTitle>
        <CardDescription>
          Area riservata agli amministratori di Visione Comune.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state.message ? (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              role="alert"
            >
              {state.message}
            </div>
          ) : null}

          <Field htmlFor="email" label="Email">
            <Input
              autoComplete="email"
              disabled={pending}
              id="email"
              name="email"
              required
              type="email"
            />
          </Field>

          <Field htmlFor="password" label="Password">
            <Input
              autoComplete="current-password"
              disabled={pending}
              id="password"
              name="password"
              required
              type="password"
            />
          </Field>

          <Button disabled={pending} type="submit">
            {pending ? "Accesso in corso..." : "Accedi"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

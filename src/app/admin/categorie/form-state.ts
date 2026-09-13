import type { CategoryFieldErrors } from "@/modules/categories/application/manage-categories";

export type CategoryActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: CategoryFieldErrors;
  values: {
    name: string;
    slug: string;
    active: string;
  };
};

export const initialCategoryActionState: CategoryActionState = {
  status: "idle",
  fieldErrors: {},
  values: {
    name: "",
    slug: "",
    active: "true"
  }
};

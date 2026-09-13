export type NewsPostActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    status?: string;
  };
  values: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    status: string;
  };
};

export const initialNewsPostActionState: NewsPostActionState = {
  status: "idle",
  fieldErrors: {},
  values: {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    status: "draft"
  }
};

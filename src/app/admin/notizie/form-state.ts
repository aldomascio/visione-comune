export type NewsPostActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: {
    title?: string;
    slug?: string;
    excerpt?: string;
    featuredImageUrl?: string;
    featuredImageAlt?: string;
    content?: string;
    status?: string;
  };
  values: {
    title: string;
    slug: string;
    excerpt: string;
    featuredImageUrl: string;
    featuredImageAlt: string;
    content: string;
    contentJson: string;
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
    featuredImageUrl: "",
    featuredImageAlt: "",
    content: "",
    contentJson: "",
    status: "draft"
  }
};

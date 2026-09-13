export type CreateReportActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  publicCode?: string;
  fieldErrors: Partial<
    Record<"categoryId" | "description" | "latitude" | "longitude" | "address", string>
  >;
  values: {
    categoryId: string;
    description: string;
    latitude: string;
    longitude: string;
    address: string;
  };
};

export const initialCreateReportActionState: CreateReportActionState = {
  status: "idle",
  fieldErrors: {},
  values: {
    categoryId: "",
    description: "",
    latitude: "",
    longitude: "",
    address: ""
  }
};

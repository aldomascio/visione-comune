import type { CreateReportFieldErrors } from "@/modules/reports/application/create-report";

export type CreateAdminReportActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  publicCode?: string;
  fieldErrors: CreateReportFieldErrors;
  values: {
    categoryId: string;
    source: string;
    description: string;
    latitude: string;
    longitude: string;
    address: string;
  };
};

export const initialCreateAdminReportActionState: CreateAdminReportActionState = {
  status: "idle",
  fieldErrors: {},
  values: {
    categoryId: "",
    source: "direct",
    description: "",
    latitude: "",
    longitude: "",
    address: ""
  }
};

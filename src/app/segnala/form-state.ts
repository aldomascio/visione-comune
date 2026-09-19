import type { PotentialDuplicateReportCandidate } from "@/modules/reports/application/duplicate-detection";

export type CreateReportActionState = {
  status: "idle" | "error" | "success" | "duplicates_found";
  message?: string;
  publicCode?: string;
  duplicateCandidates?: PotentialDuplicateReportCandidate[];
  photoSelectedBeforeDuplicateCheck?: boolean;
  fieldErrors: Partial<
    Record<"categoryId" | "title" | "description" | "latitude" | "longitude" | "address" | "photo", string>
  >;
  values: {
    categoryId: string;
    title: string;
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
    title: "",
    description: "",
    latitude: "",
    longitude: "",
    address: ""
  }
};

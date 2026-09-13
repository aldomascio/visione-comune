import { InvalidPublicCodeError } from "./errors";

const PUBLIC_CODE_PATTERN = /^VC-[0-9A-Z]{8}$/;

export class PublicCode {
  private constructor(private readonly value: string) {}

  static create(value: string): PublicCode {
    const normalizedValue = value.trim().toUpperCase();

    if (!PUBLIC_CODE_PATTERN.test(normalizedValue)) {
      throw new InvalidPublicCodeError(
        "Public code must match the format VC-XXXXXXXX using uppercase letters and digits."
      );
    }

    return new PublicCode(normalizedValue);
  }

  static isValid(value: string): boolean {
    return PUBLIC_CODE_PATTERN.test(value.trim().toUpperCase());
  }

  toString(): string {
    return this.value;
  }

  equals(other: PublicCode): boolean {
    return this.value === other.value;
  }
}


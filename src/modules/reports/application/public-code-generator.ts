import { randomInt } from "node:crypto";
import { PublicCode } from "../domain";

export type PublicCodeGenerator = {
  generate(): PublicCode;
};

export const READABLE_PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PUBLIC_CODE_RANDOM_LENGTH = 8;

export class RandomPublicCodeGenerator implements PublicCodeGenerator {
  generate(): PublicCode {
    let value = "VC-";

    for (let index = 0; index < PUBLIC_CODE_RANDOM_LENGTH; index += 1) {
      value += READABLE_PUBLIC_CODE_ALPHABET[randomInt(READABLE_PUBLIC_CODE_ALPHABET.length)];
    }

    return PublicCode.create(value);
  }
}

import { createColors } from "picocolors";
import { Colors } from "picocolors/types";
const ccolor = createColors();
interface BuilderProps {
  str: string;
  color?: Omit<keyof Colors, "isColorSupported">;
  nl?: boolean;
}

export const s = (args: BuilderProps): string => {
  const colorFn = args.color && ccolor[args.color as keyof Colors];
  let _str = args.str;

  if (typeof colorFn === "function" && typeof colorFn !== "boolean") {
    _str = colorFn(_str);
  }
  return _str + (args.nl ? "\n" : "");
};

export function b(str: string | string[], nl?: boolean): string;
export function b(str: string | string[], color?: Omit<keyof Colors, "isColorSupported">, nl?: boolean): string;
export function b(
  str: string | string[],
  color?: Omit<keyof Colors, "isColorSupported"> | boolean,
  nl?: boolean,
): string {
  let _str = str;
  if (Array.isArray(_str)) _str = _str.join("");
  if (typeof color === "boolean") {
    return str + (color ? "\n" : "");
  }

  const colorFn = color && ccolor[color as keyof Colors];

  if (typeof colorFn === "function" && typeof colorFn !== "boolean") {
    _str = colorFn(_str as string);
  }
  return _str + (nl ? "\n" : "");
}

export function t(str?: string) {
  let _str = "" + (str ?? "");

  // const that: ReturnType<typeof t> = this;

  return {
    p(color: Omit<keyof Colors, "isColorSupported">) {
      const colorFn = color && ccolor[color as keyof Colors];

      if (typeof colorFn === "function" && typeof colorFn !== "boolean") {
        _str = colorFn(_str as string);
      }
      return this;
    },
    nl() {
      _str += "\n";
      return this;
    },
    space(n: number = 1) {
      _str += " ".repeat(n);
      return this;
    },
    c(when: boolean, whenTrue: string, fallback: string) {
      let condition = when;

      if (condition) {
        _str += whenTrue;
      } else {
        _str += fallback;
      }

      return this;
    },
    t(str: string) {
      _str += str;
      return this;
    },
    print() {
      return _str;
    },
  };
}

export function when<T>(conditon: any, whenTrue: T | ((v: NonNullable<T>) => any), fallback: T): NonNullable<T>;
export function when<T>(conditon: T | any, whenTrue: T | ((v: NonNullable<T>) => any), fallback: T) {
  return Boolean(conditon)
    ? typeof whenTrue === "function"
      ? (whenTrue as (v: NonNullable<T>) => NonNullable<T>)(conditon as NonNullable<T>)
      : (whenTrue as NonNullable<T>)
    : fallback;
}

export function x(...args: string[]) {
  return args.join("");
}

export function ct(color: Omit<keyof Colors, "isColorSupported">, ...args: string[]) {
  let _str = args.join("");
  const colorFn = color && ccolor[color as keyof Colors];

  if (typeof colorFn === "function" && typeof colorFn !== "boolean") {
    _str = colorFn(_str);
  }
  return _str;
}

export const NL = "\n";

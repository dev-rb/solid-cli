import color from "picocolors";
import { ct, when, join, NL, w } from "../builder";
import { RENDERTHIS, Option, AutocompleteTextOptions } from "./autocomplete";
import { S_CHECKBOX_ACTIVE, S_CHECKBOX_SELECTED, S_CHECKBOX_INACTIVE, S_BAR } from "./utils";

const opt = (
  option: any,
  state: "inactive" | "active" | "selected" | "active-selected" | "submitted" | "cancelled",
) => {
  const label = option.label ?? String(option.value);
  if (state === "active") {
    return `${color.cyan(S_CHECKBOX_ACTIVE)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
  } else if (state === "selected") {
    return `${color.green(S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
  } else if (state === "cancelled") {
    return `${color.strikethrough(color.dim(label))}`;
  } else if (state === "active-selected") {
    return `${color.green(S_CHECKBOX_SELECTED)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
  } else if (state === "submitted") {
    return `${color.dim(label)}`;
  }
  return `${color.dim(S_CHECKBOX_INACTIVE)} ${color.dim(label)}`;
};

const getTerminalSize = () => {
  const stdout = process.stdout.getWindowSize();

  return {
    width: stdout[0],
    height: stdout[1],
  };
};

const space = (n: number) => ` `.repeat(n);

const BULLET = "•";

const instructions = color.gray(
  `↓/j down ${BULLET} ↑/k up ${BULLET} tab select ${BULLET} Ctrl-C cancel ${BULLET} / filter`,
);

const searchInstructions = color.gray(
  `tab select ${BULLET} ESC cancel filter ${BULLET} :<number> to highlight by index`,
);

const CYAN_BAR = color.cyan(S_BAR);

function selected<T extends Option>(this: RENDERTHIS<T>) {
  if (!this.selected.length) return ct("gray", "Nothing Selected");
  return this.selected.map((option, i) => ct("red", option.label ?? "")).join(" ");
}

function generateOptions<T extends Option>(this: RENDERTHIS<T>) {
  let uniqueGroups = new Set();
  let start = Math.max(0, this.cursor - 11);

  return this.filteredOptions
    .map((option, i) => {
      if (i < start || i > start + 11) return;

      const selected = this.selected.find((v) => v.value === option.value) !== undefined;
      const has = option.group && uniqueGroups.has(option.group);
      if (!has && option.group) {
        uniqueGroups.add(option.group);
      }

      const isFocused = this.cursor === i;

      const active = (i === 0 && this.mode === "search") || (this.mode === "explore" && isFocused);
      const state = when(selected, "selected", when(active, "active", "inactive"));

      const spacing = i > 9 ? " " : "  ";

      const groupView = join(
        when(has || !option.group, "", join(NL, CYAN_BAR, ct("bgBlue", ct("black", option.group!)))),
        when(!has && option.group !== undefined, join(NL, CYAN_BAR, space(2)), ""),
      );

      // prettier-ignore
      return join(
            groupView,
            String(i), ":", spacing,
            when(isFocused, ct("bgBlack", opt(option, state)), ct("dim", opt(option, state))),
          );
    })
    .filter(Boolean);
}

function o<T extends Option>(this: RENDERTHIS<T>) {
  const that = this;
  return function <F extends (...args: any[]) => any>(fn: F): ReturnType<F> {
    return fn.call(that);
  };
}

let call: ReturnType<typeof o>;

export function render<T extends Option>(this: RENDERTHIS<T>, opts: Omit<AutocompleteTextOptions<T>, "render">) {
  if (!call) call = o.call(this);

  const placeholder = w(() => {
    if (opts.placeholder) return join(ct("inverse", opts.placeholder), ct("dim", opts.placeholder.slice(1)));

    return color.inverse(color.hidden("_"));
  });

  const value = typeof this.value === "string" ? (!this.value ? placeholder : this.valueWithCursor) : "";
  // prettier-ignore
  return join(
        NL,
        CYAN_BAR, ct('yellow', S_CHECKBOX_SELECTED), " Selected Packages: ", call(selected), NL, 
        CYAN_BAR, space(1), NL,
        CYAN_BAR, when(this.mode === 'search',  join(ct("cyan", "? "), "Filter: ", value, NL), ""), NL,
        CYAN_BAR, space(2), when(!this.filteredOptions.length, ct('red', "No Results"), call(generateOptions).join(join(NL, CYAN_BAR, space(2)))), NL,
        CYAN_BAR, NL,
        CYAN_BAR, NL,
        when(this.mode === 'search', searchInstructions, instructions), NL,
      )
}

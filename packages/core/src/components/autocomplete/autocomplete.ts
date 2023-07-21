import { Key } from "node:readline";
import { Prompt } from "@clack/core";
import { TextOptions } from "@clack/prompts";
import { S_CHECKBOX_ACTIVE, S_CHECKBOX_SELECTED, S_CHECKBOX_INACTIVE, S_BAR, S_BAR_END, box, S_INFO } from "./utils";
import color from "picocolors";
import { createEffect } from "../../reactivity/core";
import { NL, b, ct, s, t, when, x } from "../builder";

export type Option = { value: any; label?: string; hint?: string; group?: string };

const buildRegex = (str: string) => {
  let s = "";

  for (let i = 0; i < str.length; i++) {
    s += str[i] + ".*";
  }

  s = ".*" + s;

  return RegExp(s);
};

const search = <T extends Option>(values: T[], lookFor: string) => {
  const group = lookFor.match(/(\w+)\/(\w+)?/);

  if (group) {
    const groupData = values.filter((option) => option.group && option.group.includes(group[1]));

    const sp = group[2];

    if (!sp) return groupData;

    const r = buildRegex(sp);
    return groupData.filter((v) => r.test((v.label ?? v.value).toLowerCase()));
  }

  const r = buildRegex(lookFor);

  return !lookFor.length ? values : values.filter((v) => r.test((v.label ?? v.value).toLowerCase()));
};

const sortByGroup = <T extends Option>(options: T[]) => {
  return [...options].sort((a, b) => {
    if (a.group && b.group) return 0;

    if (a.group && !b.group) return 1;

    return -1;
  });
};

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

const aliases = new Map([
  ["k", "up"],
  ["j", "down"],
  ["h", "left"],
  ["l", "right"],
]);

interface AutocompleteTextOptions<T extends Option> extends TextOptions {
  options: () => T[];
  render: (this: Omit<AutocompleteText<T>, "prompt">) => string | void;
}

class AutocompleteText<T extends Option> extends Prompt {
  valueWithCursor = "";
  options: T[];

  get __cursor() {
    return this._cursor;
  }
  cursor: number = 0;

  filteredOptions: T[];
  selected: T[];

  mode: "search" | "explore" = "explore";

  private toggleValue() {
    const cursorOption = this.filteredOptions[this.cursor];
    const selected = this.selected.find((v) => v.value === cursorOption.value) !== undefined;

    this.selected = selected
      ? this.selected.filter((v) => v.value !== cursorOption.value)
      : [...this.selected, cursorOption];
  }

  constructor(opts: AutocompleteTextOptions<T>) {
    super(opts);

    this.options = opts.options();
    this.filteredOptions = opts.options();
    this.selected = [];

    if (this.mode === "explore") this.value = this.options;

    createEffect(() => {
      this.options = opts.options();
      this.filteredOptions = sortByGroup(
        search(opts.options(), (typeof this.value === "string" ? this.value : "").toLowerCase()),
      );
      // @ts-ignore
      this.render();
    });

    this.customKeyPress = this.customKeyPress.bind(this);

    this.on("finalize", () => {
      if (!this.value) {
        this.value = opts.defaultValue;
      }
      this.valueWithCursor = this.value;
      this.value = this.selected;
    });

    this.on("value", () => {
      if (this.value[this.value.length - 1] === "/" && this.mode === "explore") {
        // @ts-ignore
        this.rl.clearLine();
        this.value = "";
        this.mode = "search";
        return;
      }
      if (this.mode === "explore") return;
      const value = this.value as string;
      if (this._cursor >= value.length) {
        this.valueWithCursor = `${value}${color.inverse(color.hidden("_"))}`;
      } else {
        const s1 = value.slice(0, this._cursor);
        const s2 = value.slice(this._cursor);
        this.valueWithCursor = `${s1}${color.inverse(s2)}${s2.slice(1)}`;
      }

      const indexSelector = value.match(/:(\d+)/);
      // if (!indexSelector) this.cursor = 0;

      const last = value[value.length - 1];
      if (last === ":") {
        const tillSelector = value.slice(0, value.length - 1);

        if (tillSelector.length > 0) {
          this.filteredOptions = sortByGroup(search(this.options, tillSelector));
        } else {
          this.filteredOptions = sortByGroup(this.options);
        }

        return;
      }

      if (indexSelector && indexSelector[1]) {
        const index = Number(indexSelector[1]);

        if (this.filteredOptions.length > 1 && index > this.filteredOptions.length - 1) {
          this.state = "error";
          return;
        }
        this.cursor = index;
        return;
      }

      const before = this.filteredOptions.length;
      this.filteredOptions = sortByGroup(search(this.options, value.toLowerCase()));
      const after = this.filteredOptions.length;

      if (before !== after) {
        this.cursor = 0;
      }
    });
    this.on("cursor", (key) => {
      if (this.mode === "explore" && key === "/") return;
      switch (key) {
        case "left":
        case "up":
          this.cursor = this.cursor === 0 ? this.filteredOptions.length - 1 : this.cursor - 1;
          break;
        case "down":
        case "right":
          this.cursor = this.cursor === this.filteredOptions.length - 1 ? 0 : this.cursor + 1;
          break;
        case "tab":
          this.toggleValue();
          break;
      }
    });
    this.input.on("keypress", this.customKeyPress);
  }

  private customKeyPress(char: string, key?: Key) {
    if (this.mode === "explore" && key?.name && aliases.has(key.name)) {
      this.emit("cursor", aliases.get(key.name));
    }
    if (key?.name === "tab") {
      const focusedOption = this.filteredOptions[this.cursor];
      const selected = this.selected.find((v) => v?.value === focusedOption?.value) !== undefined;
      if (selected) {
        this.selected = this.selected.filter((v) => v !== focusedOption);
      } else {
        this.selected = this.filteredOptions?.length === 0 ? this.selected : [...this.selected, focusedOption];
      }
      // @ts-ignore
      this.rl.clearLine();
    } else if (key?.name === "escape") {
      if (this.mode === "search") {
        this.mode = "explore";
        return;
      }
    }
  }
}

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

export const autocomplete = <T extends Option>(opts: Omit<AutocompleteTextOptions<T>, "render">) => {
  return new AutocompleteText({
    options: opts.options,
    message: opts.message,
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
      const selected = when(
        this.selected.length === 0,
        ct("gray", "Nothing Selected"),
        this.selected.map((option, i) => ct("red", option.label ?? "")).join(" "),
      );

      const placeholder = when(
        opts.placeholder,
        (p) => x(ct("inverse", p[0]), ct("dim", opts.placeholder!.slice(1))),
        color.inverse(color.hidden("_")),
      );

      const value = typeof this.value === "string" ? (!this.value ? placeholder : this.valueWithCursor) : "";

      const textView = x(ct("cyan", "? "), "Filter: ", value, NL);

      const noResults = color.red("No results");

      let uniqueGroups = new Set();
      let start = Math.max(0, this.cursor - 11);

      const filteredOptions = this.filteredOptions
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

          const groupView = x(
            when(has || !option.group, "", x(NL, CYAN_BAR, ct("bgBlue", ct("black", option.group!)))),
            when(!has && option.group !== undefined, x(NL, CYAN_BAR, space(2)), ""),
          );

          // prettier-ignore
          return x(
            groupView,
            String(i), ":", spacing,
            when(isFocused, ct("bgBlack", opt(option, state)), ct("dim", opt(option, state))),
          );
        })
        .filter(Boolean)
        .join(x(NL, CYAN_BAR, space(2)));

      // prettier-ignore
      const options = x(
        CYAN_BAR, space(2), when(!this.filteredOptions.length, noResults, filteredOptions),
        NL,
        ct("cyan", S_BAR_END),
        NL,
      );

      // prettier-ignore
      return(
      x(
          CYAN_BAR, space(1), NL, space(1), 
          CYAN_BAR, ct('yellow', S_CHECKBOX_SELECTED), " Selected Packages: ", selected, NL, 
          CYAN_BAR, space(1), NL,
          when(this.mode === 'search', x(CYAN_BAR, space(1), textView), ""),
          options, NL, when(this.mode === 'search', searchInstructions, instructions)
        )
      )
    },
  }).prompt() as Promise<T[] | symbol>;
};

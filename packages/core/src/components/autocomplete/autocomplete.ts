import { Key } from "node:readline";
import { Prompt } from "@clack/core";
import { TextOptions } from "@clack/prompts";
import color from "picocolors";
import { createEffect } from "../../reactivity/core";
import { render } from "./render";

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

const aliases = new Map([
  ["k", "up"],
  ["j", "down"],
  ["h", "left"],
  ["l", "right"],
]);

export type RENDERTHIS<T extends Option> = Omit<AutocompleteText<T>, "prompt">;

export interface AutocompleteTextOptions<T extends Option> extends TextOptions {
  options: () => T[];
  render: (this: RENDERTHIS<T>) => string | void;
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

export const autocomplete = <T extends Option>(opts: Omit<AutocompleteTextOptions<T>, "render">) => {
  return new AutocompleteText({
    options: opts.options,
    message: opts.message,
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
      return render.call(this, opts);
    },
  }).prompt() as Promise<T[] | symbol>;
};

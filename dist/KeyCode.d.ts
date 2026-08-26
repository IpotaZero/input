import type { KeyboardEventCode } from "types-keyboardevent";
export type GamepadButtons = `gamepad-button-${number}`;
export type GamepadAxis = `gamepad-axis-${number}-${"positive" | "negative"}`;
export type ConfigString = KeyboardEventCode | GamepadButtons | GamepadAxis;
export type Source = {
    type: "keyboard";
    code: KeyboardEventCode;
} | {
    type: "gamepad-button";
    index: number;
} | {
    type: "gamepad-axis";
    index: number;
    direction: "positive" | "negative";
};

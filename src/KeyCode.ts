import type { KeyboardEventCode } from "types-keyboardevent"

export type GamepadButtons = `gamepad-button-${number}`
export type GamepadAxis = `gamepad-axis-${number}-${"positive" | "negative"}`

export type ConfigString = KeyboardEventCode | GamepadButtons | GamepadAxis

type A = "Minus" extends KeyboardEventCode ? true : false

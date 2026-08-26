import type { KeyboardEventCode } from "types-keyboardevent"

/**
 * キーボードのキー、またはゲームパッドのボタン/軸を指し示す型。
 * DigitalInput.Config / KeyConfig.waitForAnyInput で共通して使う。
 */
export type Source =
    | { type: "keyboard"; code: KeyboardEventCode }
    | { type: "gamepad-button"; index: number }
    | { type: "gamepad-axis"; index: number; direction: "positive" | "negative" }

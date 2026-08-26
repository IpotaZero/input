import type { KeyboardEventCode } from "types-keyboardevent"

/**
 * キーボードのキー、またはゲームパッドのボタン/軸を指し示す型。
 * DigitalInput.Config / KeyConfig.waitForAnyInput で共通して使う。
 */
export type Source =
    | { type: "keyboard"; code: KeyboardEventCode }
    | { type: "gamepad-button"; index: number }
    | { type: "gamepad-axis"; index: number; direction: "positive" | "negative" }

export namespace SourceKey {
    /**
     * Sourceを一意な文字列に変換する。Sourceはオブジェクトなので参照ではなく値で同一性を
     * 判定したい場面（Set/Mapのキーにする、重複判定する等）で使う。
     */
    export function toKey(source: Source): string {
        switch (source.type) {
            case "keyboard":
                return `keyboard:${source.code}`
            case "gamepad-button":
                return `gamepad-button:${source.index}`
            case "gamepad-axis":
                return `gamepad-axis:${source.index}:${source.direction}`
        }
    }

    export function equals(a: Source, b: Source): boolean {
        return toKey(a) === toKey(b)
    }
}

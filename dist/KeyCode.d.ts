import type { KeyboardEventCode } from "types-keyboardevent";
/**
 * キーボードのキー、またはゲームパッドのボタン/軸を指し示す型。
 * DigitalInput.Config / KeyConfig.waitForAnyInput で共通して使う。
 */
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
export declare namespace SourceKey {
    /**
     * Sourceを一意な文字列に変換する。Sourceはオブジェクトなので参照ではなく値で同一性を
     * 判定したい場面（Set/Mapのキーにする、重複判定する等）で使う。
     */
    function toKey(source: Source): string;
    function equals(a: Source, b: Source): boolean;
}

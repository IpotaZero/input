import { Keys } from "./KeyCode";
/**
 * キーボードの2キーを +1 / -1 の軸として扱うソース。
 */
export type AnalogKeyboardSource = {
    type: "keyboard";
    positive: Keys;
    negative?: Keys;
};
/**
 * ゲームパッドのアナログ軸（スティック等）を読み取るソース。
 * threshold未満の入力はデッドゾーンとして0に丸められる。
 * scalarは出力にかける倍率（最終的に-1〜1にクランプされる）。
 * invertを立てると符号を反転する。
 */
export type AnalogAxisSource = {
    type: "gamepad-axis";
    axis: number;
    threshold?: number;
    scalar?: number;
    invert?: boolean;
};
/**
 * ゲームパッドのボタン（アナログトリガー等）を読み取るソース。
 * positiveボタンの値をそのまま+方向、negativeボタンの値を-方向として扱い、
 * 両方指定されている場合は positive - negative を最終値とする。
 */
export type AnalogButtonSource = {
    type: "gamepad-button";
    positive: number;
    negative?: number;
    threshold?: number;
    scalar?: number;
};
export type AnalogSource = AnalogKeyboardSource | AnalogAxisSource | AnalogButtonSource;
export type AnalogInputReader<Action extends string> = {
    getValue(action: Action): number;
};
/**
 * キーボードとゲームパッドのアナログ入力（軸/トリガー）を統一的に扱うためのクラス。
 *
 * 例:
 * const ai = new AnalogInput({
 *     horizontal: [
 *         { type: "gamepad-axis", axis: 0, threshold: 0.1, scalar: 1 },
 *         { type: "keyboard", positive: "KeyD", negative: "KeyA" },
 *         { type: "gamepad-button", positive: 1, negative: 4 },
 *     ],
 * })
 *
 * 1つのアクションに複数のソースを割り当てた場合、
 * 各ソースが返す値のうち絶対値が最大のものを採用する
 * （どれか1つの入力方法が「効いていれば」それを優先する、DigitalInputのOR的な発想と同じ）。
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export declare class AnalogInput<Action extends string> implements AnalogInputReader<Action> {
    private readonly config;
    private readonly values;
    private readonly pressedKeys;
    private readonly ac;
    private readonly disableReasons;
    private isPaused;
    pause(reason: string): void;
    resume(reason: string): void;
    constructor(config: Record<Action, readonly AnalogSource[]>);
    /**
     * フレームの最後に呼び出す。
     */
    update(): void;
    getValue(action: Action): number;
    clear(): void;
    /**
     * イベントリスナーを解除する。
     */
    dispose(): void;
    private readSource;
    private readKeyboard;
    private readGamepadAxis;
    private readGamepadButton;
    private clamp;
    private onKeyDown;
    private onKeyUp;
}

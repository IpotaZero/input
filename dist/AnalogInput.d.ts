import type { KeyboardEventCode } from "types-keyboardevent";
export declare namespace AnalogInput {
    /**
     * キーボードのキーを読み取るソース。
     * 押されていれば1、押されていなければ0。
     */
    type KeyboardSource = {
        type: "keyboard";
        code: KeyboardEventCode;
    };
    /**
     * ゲームパッドのアナログ軸（スティック等）を読み取るソース。
     * directionで指定した向き（positive: +方向, negative: -方向）の成分のみを[0,1]で返す。
     * threshold未満の入力はデッドゾーンとして0に丸められる。
     */
    type AxisSource = {
        type: "gamepad-axis";
        index: number;
        direction: "positive" | "negative";
        threshold?: number;
    };
    /**
     * ゲームパッドのボタン（アナログトリガー等）を読み取るソース。
     * ボタンの値をそのまま[0,1]で返す。
     * threshold未満の入力はデッドゾーンとして0に丸められる。
     */
    type ButtonSource = {
        type: "gamepad-button";
        index: number;
        threshold?: number;
    };
    type Source = KeyboardSource | AxisSource | ButtonSource;
    type Reader<Action extends string> = {
        /** [0,1]を取る。 */
        getValue(action: Action): number;
    };
    type Config<Action extends string> = Record<Action, readonly AnalogInput.Source[]>;
}
/**
 * キーボードとゲームパッドのアナログ入力（軸/トリガー）を統一的に扱うためのクラス。
 * 各ソースは[0,1]の値を返し、1つのアクションに複数のソースを割り当てた場合はそのうち最大のものを採用する
 * （どれか1つの入力方法が「効いていれば」それを優先する、DigitalInputのOR的な発想と同じ）。
 * 正負両方向が必要な場合（左右移動など）は、アクション自体を分けてdirectionで向きを指定する。
 *
 * 例:
 * const ai = new AnalogInput({
 *     left: [
 *         { type: "gamepad-axis", index: 0, threshold: 0.1, direction: "negative" },
 *         { type: "keyboard", code: "KeyA" },
 *         { type: "gamepad-button", index: 1 },
 *     ],
 *     right: [
 *         { type: "gamepad-axis", index: 0, threshold: 0.1, direction: "positive" },
 *         { type: "keyboard", code: "KeyD" },
 *         { type: "gamepad-button", index: 3 },
 *     ],
 * })
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export declare class AnalogInput<Action extends string> implements AnalogInput.Reader<Action> {
    private readonly gamepadIndex;
    private readonly config;
    private readonly values;
    private readonly pressedKeys;
    private readonly ac;
    private readonly disableReasons;
    private isPaused;
    pause(reason: string): void;
    resume(reason: string): void;
    updateConfig(config: AnalogInput.Config<Action>): void;
    constructor(config: AnalogInput.Config<Action>, gamepadIndex?: number[]);
    /**
     * フレームの最後に呼び出す。
     */
    update(): void;
    private process;
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
    /** [0,1]にクランプする。 */
    private clamp;
    private onKeyDown;
    private onKeyUp;
}

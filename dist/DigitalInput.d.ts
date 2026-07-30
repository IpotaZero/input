import { ConfigString } from "./KeyCode";
export declare namespace DigitalInput {
    type Reader<Action extends string> = {
        isPressed(action: Action): boolean;
        isReleased(action: Action): boolean;
        isPushed(action: Action): boolean;
        isSomethingPressed(): boolean;
        isSomethingPushed(): boolean;
        /**
         * 押しっぱなしの間、一定間隔(intervalMs)ごとにtrueを返す(いわゆるキーリピート/オートリピート)。
         * 「ガ・ガガガガガ」のように、最初の1発はinitialDelayMs後、以降はintervalMsごとに発生する。
         * 毎フレーム呼び出して使う。
         */
        isRepeatPushed(action: Action, intervalMs: number, initialDelayMs?: number): boolean;
    };
    type Config<Action extends string> = Record<Action, readonly ConfigString[]>;
}
/**
 * e.codeまたは、ゲームパッドのボタン/軸に対応する文字列をアクションに割り当てることで、
 * キーボードとゲームパッドの入力を統一的に扱えるようにする。
 *
 * 例: new DigitalInput({ right: ["ArrowRight", "gamepad-button-15", "gamepad-axis-0-positive"] })
 * これで、右矢印キーまたはゲームパッドの右ボタンが押されるまたは左スティックを右に倒すと、action "right" が押されたことになる。
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export declare class DigitalInput<Action extends string> implements DigitalInput.Reader<Action> {
    private readonly pressedCodes;
    private readonly released;
    private readonly pushed;
    private readonly repeatNextFireAt;
    private readonly ac;
    private readonly disableReasons;
    private readonly config;
    private readonly codeToActions;
    private isPaused;
    pause(reason: string): void;
    resume(reason: string): void;
    updateConfig(config: DigitalInput.Config<Action>): void;
    constructor(config: DigitalInput.Config<Action>);
    /**
     * フレームの最後に呼び出す。
     */
    update(): void;
    dispose(): void;
    private processGamepadInput;
    /**押されているか? */
    isPressed(action: Action): boolean;
    /**ちょうどこのフレームに離されたか? */
    isReleased(action: Action): boolean;
    /**ちょうどこのフレームに押されたか? */
    isPushed(action: Action): boolean;
    isSomethingPressed(): boolean;
    isSomethingPushed(): boolean;
    /**
     * 押しっぱなしの間、一定間隔(intervalMs)ごとにtrueを返す(いわゆるキーリピート/オートリピート)。
     * 「ガ・ガガガガガ」のように、最初の1発はinitialDelayMs後、以降はintervalMsごとに発生する。
     *
     * 例: isRepeatPushed("attack", 100, 400)
     *   → 押した瞬間に1回true、その400ms後にもう1回true、以降100ms間隔でtrueを返し続ける
     *
     * 毎フレーム呼び出して使うこと。離す/他のコードで押され続けていない状態になるとリセットされる。
     */
    isRepeatPushed(action: Action, intervalMs: number, initialDelayMs?: number): boolean;
    clear(): void;
    private isActionPressed;
    private onKeyDown;
    private onKeyUp;
    private press;
    private release;
    private updateGamepadState;
}

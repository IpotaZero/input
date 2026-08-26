import type { Source } from "./KeyCode";
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
        clear(): void;
    };
    type Config<Action extends string> = Record<Action, readonly Source[]>;
}
/**
 * e.code、またはゲームパッドのボタン/軸を表すSourceをアクションに割り当てることで、
 * キーボードとゲームパッドの入力を統一的に扱えるようにする。
 *
 * 例: new DigitalInput({
 *     right: [
 *         { type: "keyboard", code: "ArrowRight" },
 *         { type: "gamepad-button", index: 15 },
 *         { type: "gamepad-axis", index: 0, direction: "positive" },
 *     ],
 * })
 * これで、右矢印キーまたはゲームパッドの右ボタンが押されるまたは左スティックを右に倒すと、action "right" が押されたことになる。
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export declare class DigitalInput<Action extends string> implements DigitalInput.Reader<Action> {
    private readonly gamepadIndex;
    private readonly pressedKeys;
    private readonly released;
    private readonly pushed;
    private readonly repeatNextFireAt;
    private readonly ac;
    private readonly disableReasons;
    private readonly config;
    private readonly keyToActions;
    private isPaused;
    /**
     * 一時停止する。
     * @param reason 停止する理由
     */
    pause(reason: string): void;
    /** pauseを解除 */
    resume(reason: string): void;
    updateConfig(config: DigitalInput.Config<Action>): void;
    constructor(config: DigitalInput.Config<Action>, gamepadIndex?: number[]);
    /**
     * 毎フレームの終わりに呼ぶ。
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
     * 毎フレーム呼び出して使うこと。離す/他のSourceで押され続けていない状態になるとリセットされる。
     */
    isRepeatPushed(action: Action, intervalMs?: number, initialDelayMs?: number): boolean;
    clear(): void;
    /**
     * アクションに割り当てられたSourceのうち、どれか一つでも押されていればそのアクションは「押されている」とみなす
     */
    private isActionPressed;
    private onKeyDown;
    private onKeyUp;
    /**
     * 新規にSourceが押されたことを記録する。pause中は「新規に押される」ことだけを無視する
     * (例: キーコンフィグの入力待ち中に、たまたま別のキーが押されてもゲーム側の入力として扱わない)。
     * 一方releaseはpause中でも常に反映する。そうしないと、pauseした瞬間にたまたま押されていた
     * キー/ボタンが、pause中に離されたことを検知できずに「押されっぱなし」のまま固まってしまい、
     * resume後にそのキー/ボタンが二度と反応しなくなる (または離すまで別の入力として誤検知され続ける)。
     *
     * pause中でも物理的な押下状態そのもの(pressedKeys)は必ず記録する。キーボードのkeydown、
     * ゲームパッドのポーリング(update()内のupdateGamepadState())ともに、pause中かどうかに
     * 関わらずこのpress()自体は呼ばれ続けるので、ここで記録を止めてしまうとpause解除時に
     * 「押されっぱなしのボタン」を新規pushとして誤検知することになる。
     */
    private press;
    private release;
    private updateGamepadState;
}

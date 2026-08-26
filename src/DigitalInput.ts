import type { KeyboardEventCode } from "types-keyboardevent"
import type { Source } from "./KeyCode"
import { SourceKey } from "./KeyCode"

export namespace DigitalInput {
    export type Reader<Action extends string> = {
        isPressed(action: Action): boolean
        isReleased(action: Action): boolean
        isPushed(action: Action): boolean
        isSomethingPressed(): boolean
        isSomethingPushed(): boolean
        /**
         * 押しっぱなしの間、一定間隔(intervalMs)ごとにtrueを返す(いわゆるキーリピート/オートリピート)。
         * 「ガ・ガガガガガ」のように、最初の1発はinitialDelayMs後、以降はintervalMsごとに発生する。
         * 毎フレーム呼び出して使う。
         */
        isRepeatPushed(action: Action, intervalMs: number, initialDelayMs?: number): boolean

        clear(): void
    }

    export type Config<Action extends string> = Record<Action, readonly Source[]>
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
export class DigitalInput<Action extends string> implements DigitalInput.Reader<Action> {
    // 実際に押されているSourceの集合（sourceKey()で文字列化したもの）
    // （アクション単位ではなくSource単位で保持することで、
    //   同じアクションに複数のSourceが割り当てられているときに
    //   片方を離しただけでアクション全体がOFFになるのを防ぐ）
    private readonly pressedKeys = new Set<string>()

    // こちらは従来通りアクション単位の「今フレームで新たに押された/離された」エッジ集合
    private readonly released = new Set<Action>()
    private readonly pushed = new Set<Action>()

    // isRepeatPushed用: アクションごとに「次にパルスを発生させる時刻」を保持する
    private readonly repeatNextFireAt = new Map<Action, number>()

    private readonly ac = new AbortController()

    private readonly disableReasons = new Set<string>()
    private readonly config = new Map<Action, readonly Source[]>()
    private readonly keyToActions = new Map<string, Action[]>()

    private isPaused(): boolean {
        return this.disableReasons.size > 0
    }

    pause(reason: string): void {
        this.disableReasons.add(reason)
    }

    resume(reason: string): void {
        this.disableReasons.delete(reason)
    }

    updateConfig(config: DigitalInput.Config<Action>) {
        this.config.clear()
        this.keyToActions.clear()

        const entries = Object.entries(config)

        for (const [action, sources] of entries as Iterable<[Action, readonly Source[]]>) {
            this.config.set(action, [...sources])

            for (const source of sources) {
                const key = SourceKey.toKey(source)
                const actions = this.keyToActions.get(key) ?? []
                actions.push(action)
                this.keyToActions.set(key, actions)
            }
        }
    }

    constructor(
        config: DigitalInput.Config<Action>,
        private readonly gamepadIndex = [0, 1, 2, 3],
    ) {
        this.updateConfig(config)
        window.addEventListener("keydown", this.onKeyDown, { signal: this.ac.signal })
        window.addEventListener("keyup", this.onKeyUp, { signal: this.ac.signal })
    }

    /**
     * 毎フレームの終わりに呼ぶ。
     */
    update() {
        this.pushed.clear()
        this.released.clear()
        this.updateGamepadState()
    }

    dispose() {
        this.ac.abort()
    }

    private processGamepadInput(gamepad: Gamepad) {
        gamepad.buttons.forEach((button, index) => {
            const key = SourceKey.toKey({ type: "gamepad-button", index })

            if (!this.keyToActions.has(key)) return

            if (button.pressed) {
                this.press(key)
            } else {
                this.release(key)
            }
        })

        gamepad.axes.forEach((axis, index) => {
            const positiveKey = SourceKey.toKey({ type: "gamepad-axis", index, direction: "positive" })
            const negativeKey = SourceKey.toKey({ type: "gamepad-axis", index, direction: "negative" })
            if (!this.keyToActions.has(positiveKey) && !this.keyToActions.has(negativeKey)) return

            if (axis > 0.5) {
                this.press(positiveKey)
                this.release(negativeKey)
            } else if (axis < -0.5) {
                this.press(negativeKey)
                this.release(positiveKey)
            } else {
                this.release(positiveKey)
                this.release(negativeKey)
            }
        })
    }

    /**押されているか? */
    isPressed(action: Action): boolean {
        if (this.isPaused()) return false

        return this.isActionPressed(action)
    }

    /**ちょうどこのフレームに離されたか? */
    isReleased(action: Action): boolean {
        if (this.isPaused()) return false

        return this.released.has(action)
    }

    /**ちょうどこのフレームに押されたか? */
    isPushed(action: Action): boolean {
        if (this.isPaused()) return false

        return this.pushed.has(action)
    }

    isSomethingPressed(): boolean {
        if (this.isPaused()) return false

        return this.pressedKeys.size > 0
    }

    isSomethingPushed(): boolean {
        if (this.isPaused()) return false

        return this.pushed.size > 0
    }

    /**
     * 押しっぱなしの間、一定間隔(intervalMs)ごとにtrueを返す(いわゆるキーリピート/オートリピート)。
     * 「ガ・ガガガガガ」のように、最初の1発はinitialDelayMs後、以降はintervalMsごとに発生する。
     *
     * 例: isRepeatPushed("attack", 100, 400)
     *   → 押した瞬間に1回true、その400ms後にもう1回true、以降100ms間隔でtrueを返し続ける
     *
     * 毎フレーム呼び出して使うこと。離す/他のSourceで押され続けていない状態になるとリセットされる。
     */
    isRepeatPushed(action: Action, intervalMs: number = 100, initialDelayMs: number = 400): boolean {
        if (this.isPaused()) return false

        if (!this.isActionPressed(action)) {
            this.repeatNextFireAt.delete(action)
            return false
        }

        const now = performance.now()
        const nextFireAt = this.repeatNextFireAt.get(action)

        // 新規プレス(このメソッドとしては初回)なので最初の「ガ」を発生させる
        if (nextFireAt === undefined) {
            this.repeatNextFireAt.set(action, now + initialDelayMs)
            return true
        }

        if (now >= nextFireAt) {
            this.repeatNextFireAt.set(action, now + intervalMs)
            return true
        }

        return false
    }

    clear(): void {
        this.pressedKeys.clear()
        this.released.clear()
        this.pushed.clear()
        this.repeatNextFireAt.clear()
    }

    // アクションに割り当てられたSourceのうち、どれか一つでも
    // 押されていればそのアクションは「押されている」とみなす
    private isActionPressed(action: Action): boolean {
        const sources = this.config.get(action)
        if (!sources) return false

        return sources.some((source) => this.pressedKeys.has(SourceKey.toKey(source)))
    }

    private onKeyDown = (e: KeyboardEvent) => {
        const key = SourceKey.toKey({ type: "keyboard", code: e.code as KeyboardEventCode })
        if (!this.keyToActions.has(key)) return

        this.press(key)
    }

    private onKeyUp = (e: KeyboardEvent) => {
        const key = SourceKey.toKey({ type: "keyboard", code: e.code as KeyboardEventCode })
        if (!this.keyToActions.has(key)) return

        this.release(key)
    }


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
    private press(key: string) {
        if (this.pressedKeys.has(key)) return

        if (!this.isPaused()) {
            const actions = this.keyToActions.get(key)
            if (actions) {
                for (const action of actions) {
                    // 他のSource経由で既に押されている場合は「新規に押された」扱いにしない
                    if (!this.isActionPressed(action)) {
                        this.pushed.add(action)
                    }
                }
            }
        }

        this.pressedKeys.add(key)
    }

    private release(key: string) {
        if (!this.pressedKeys.has(key)) return

        this.pressedKeys.delete(key)

        const actions = this.keyToActions.get(key)
        if (actions) {
            for (const action of actions) {
                // 他のSourceがまだ押されている場合はアクションとしてはまだ押された状態を維持する
                if (!this.isActionPressed(action)) {
                    this.released.add(action)
                }
            }
        }
    }

    private updateGamepadState() {
        navigator.getGamepads().forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index)) return
            if (!gamepad) return

            this.processGamepadInput(gamepad)
        })
    }
}

import type { ConfigString } from "./KeyCode"

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

    export type Config<Action extends string> = Record<Action, readonly ConfigString[]>
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
export class DigitalInput<Action extends string> implements DigitalInput.Reader<Action> {
    // 実際に押されているキーコード/ゲームパッドコードの集合
    // （アクション単位ではなくコード単位で保持することで、
    //   同じアクションに複数のコードが割り当てられているときに
    //   片方を離しただけでアクション全体がOFFになるのを防ぐ）
    private readonly pressedCodes = new Set<ConfigString>()

    // こちらは従来通りアクション単位の「今フレームで新たに押された/離された」エッジ集合
    private readonly released = new Set<Action>()
    private readonly pushed = new Set<Action>()

    // isRepeatPushed用: アクションごとに「次にパルスを発生させる時刻」を保持する
    private readonly repeatNextFireAt = new Map<Action, number>()

    private readonly ac = new AbortController()

    private readonly disableReasons = new Set<string>()
    private readonly config = new Map<Action, readonly ConfigString[]>()
    private readonly codeToActions = new Map<ConfigString, Action[]>()

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
        this.codeToActions.clear()

        const entries = Object.entries(config)

        for (const [action, codes] of entries as Iterable<[Action, readonly ConfigString[]]>) {
            this.config.set(action, [...codes])

            for (const code of codes) {
                const actions = this.codeToActions.get(code) ?? []
                actions.push(action)
                this.codeToActions.set(code, actions)
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
     * 毎フレーム、呼び出し元(アプリのメインループ)から呼ぶ。呼び出し元が何をしていようと関係なく必ず呼ばれる、という点がポイント。
     *
     * ゲームパッドはkeydown/keyupのようなイベントを持たないため、ここでのポーリングでしか状態を
     * 検知できない。isPressed()等の呼び出しタイミングに便乗して更新する方式だと、呼び出し側が
     * しばらく呼んでくれない期間(pause中など)に状態追跡が完全に止まってしまい、その間の押下/解放を
     * 取りこぼした結果、後から辻褄が合わなくなる(新規pushの誤検知など)。
     * ここで一元的に、呼び出し側の都合に依存せず毎フレーム確実にポーリングすることで、
     * キーボードのイベントリスナーと同じく「物理的な状態変化と同期してpress()/release()が呼ばれる」
     * という性質になり、キーボードとゲームパッドの挙動を一致させられる。
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
            const code: ConfigString = `gamepad-button-${index}`

            if (!this.codeToActions.has(code)) return

            if (button.pressed) {
                this.press(code)
            } else {
                this.release(code)
            }
        })

        gamepad.axes.forEach((axis, index) => {
            const positiveCode: ConfigString = `gamepad-axis-${index}-positive`
            const negativeCode: ConfigString = `gamepad-axis-${index}-negative`
            if (!this.codeToActions.has(positiveCode) && !this.codeToActions.has(negativeCode)) return

            if (axis > 0.5) {
                this.press(positiveCode)
                this.release(negativeCode)
            } else if (axis < -0.5) {
                this.press(negativeCode)
                this.release(positiveCode)
            } else {
                this.release(positiveCode)
                this.release(negativeCode)
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

        return this.pressedCodes.size > 0
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
     * 毎フレーム呼び出して使うこと。離す/他のコードで押され続けていない状態になるとリセットされる。
     */
    isRepeatPushed(action: Action, intervalMs: number, initialDelayMs: number = intervalMs): boolean {
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
        this.pressedCodes.clear()
        this.released.clear()
        this.pushed.clear()
        this.repeatNextFireAt.clear()
    }

    // アクションに割り当てられたコードのうち、どれか一つでも
    // 押されていればそのアクションは「押されている」とみなす
    private isActionPressed(action: Action): boolean {
        const codes = this.config.get(action)
        if (!codes) return false

        return codes.some((code) => this.pressedCodes.has(code))
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.codeToActions.has(e.code as ConfigString)) return

        this.press(e.code as ConfigString)
    }

    private onKeyUp = (e: KeyboardEvent) => {
        if (!this.codeToActions.has(e.code as ConfigString)) return

        this.release(e.code as ConfigString)
    }

    /**
     * 新規にコードが押されたことを記録する。pause中は「新規に押される」ことだけを無視する
     * (例: キーコンフィグの入力待ち中に、たまたま別のキーが押されてもゲーム側の入力として扱わない)。
     * 一方releaseはpause中でも常に反映する。そうしないと、pauseした瞬間にたまたま押されていた
     * キー/ボタンが、pause中に離されたことを検知できずに「押されっぱなし」のまま固まってしまい、
     * resume後にそのキー/ボタンが二度と反応しなくなる (または離すまで別の入力として誤検知され続ける)。
     *
     * pause中でも物理的な押下状態そのもの(pressedCodes)は必ず記録する。キーボードのkeydown、
     * ゲームパッドのポーリング(update()内のupdateGamepadState())ともに、pause中かどうかに
     * 関わらずこのpress()自体は呼ばれ続けるので、ここで記録を止めてしまうとpause解除時に
     * 「押されっぱなしのボタン」を新規pushとして誤検知することになる。
     */
    private press(code: ConfigString) {
        if (this.pressedCodes.has(code)) return

        if (!this.isPaused()) {
            const actions = this.codeToActions.get(code)
            if (actions) {
                for (const action of actions) {
                    // 他のコード経由で既に押されている場合は「新規に押された」扱いにしない
                    if (!this.isActionPressed(action)) {
                        this.pushed.add(action)
                    }
                }
            }
        }

        this.pressedCodes.add(code)
    }

    private release(code: ConfigString) {
        if (!this.pressedCodes.has(code)) return

        this.pressedCodes.delete(code)

        const actions = this.codeToActions.get(code)
        if (actions) {
            for (const action of actions) {
                // 他のコードがまだ押されている場合はアクションとしてはまだ押された状態を維持する
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

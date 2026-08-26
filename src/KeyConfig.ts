import type { KeyboardEventCode } from "types-keyboardevent"
import type { Source } from "./KeyCode"

export namespace KeyConfig {
    export type Options = {
        /** ゲームパッドの軸をpressedとみなす閾値の絶対値 (デフォルト0.5) */
        axisThreshold?: number
        /** ゲームパッドのボタンをpressedとみなす閾値 (デフォルト0.5) */
        buttonThreshold?: number
        /** これがabortされると待機を中断し、Promiseはreject(AbortError)される */
        signal?: AbortSignal
    }
}

/**
 * キーコンフィグ画面向け: キーボードまたはゲームパッドで何らかの入力が行われるまで待ち、
 * 押された入力に対応する Source (DigitalInput.Configにそのまま使える) を返す。
 * AnalogInputのConfigに使う場合は、返り値を各Source型（threshold等を追加可能）に変換して使うこと。
 *
 * - キーボードは keydown イベントで検知する (KeyCode.ts の keys 一覧に含まれるコードのみ)。
 * - ゲームパッドはボタン押下イベントを持たないため、rAFで毎フレームポーリングする。
 *   呼び出し時点で既に押されている/倒されているボタン・軸は「呼び出し前からの入力」とみなして無視し、
 *   一度離れてから新たに閾値を超えたものだけを「入力された」として検知する。
 *   (こうしないと、ユーザーがボタンを押しっぱなしのままこの関数を呼んだ瞬間に即resolveしてしまう)
 *
 * @example
 * const code = await KeyConfig.waitForAnyInput()
 * config[action] = [...config[action], code]
 */
export namespace KeyConfig {
    export function waitForAnyInput(options: KeyConfig.Options = {}): Promise<Source> {
        const axisThreshold = options.axisThreshold ?? 0.5
        const buttonThreshold = options.buttonThreshold ?? 0.5

        return new Promise<Source>((resolve, reject) => {
            if (options.signal?.aborted) {
                reject(new DOMException("Aborted", "AbortError"))
                return
            }

            const ac = new AbortController()
            let rafId: number

            const finish = (result: { ok: true; source: Source } | { ok: false }): void => {
                ac.abort()
                cancelAnimationFrame(rafId)
                if (result.ok) {
                    resolve(result.source)
                } else {
                    reject(new DOMException("Aborted", "AbortError"))
                }
            }

            options.signal?.addEventListener("abort", () => finish({ ok: false }), { signal: ac.signal })

            window.addEventListener(
                "keydown",
                (e) => {
                    finish({ ok: true, source: { type: "keyboard", code: e.code as KeyboardEventCode } })
                },
                { signal: ac.signal },
            )

            // 呼び出し時点で押されている/倒されているゲームパッド入力の初期スナップショット
            // (これらは押しっぱなしとみなし、離れるまで新規入力として検知しない)
            const stillHeld = new Set<string>()
            for (const gamepad of navigator.getGamepads()) {
                if (!gamepad) continue
                gamepad.buttons.forEach((button, index) => {
                    if (button.value >= buttonThreshold || button.pressed) {
                        stillHeld.add(`b${gamepad.index}:${index}`)
                    }
                })
                gamepad.axes.forEach((axis, index) => {
                    if (Math.abs(axis) >= axisThreshold) {
                        stillHeld.add(`a${gamepad.index}:${index}`)
                    }
                })
            }

            const pollGamepad = (): void => {
                for (const gamepad of navigator.getGamepads()) {
                    if (!gamepad) continue

                    for (let index = 0; index < gamepad.buttons.length; index++) {
                        const key = `b${gamepad.index}:${index}`
                        const pressed =
                            gamepad.buttons[index].value >= buttonThreshold || gamepad.buttons[index].pressed

                        if (!pressed) {
                            stillHeld.delete(key)
                            continue
                        }
                        if (stillHeld.has(key)) continue

                        finish({ ok: true, source: { type: "gamepad-button", index } })
                        return
                    }

                    for (let index = 0; index < gamepad.axes.length; index++) {
                        const value = gamepad.axes[index]
                        const key = `a${gamepad.index}:${index}`

                        if (Math.abs(value) < axisThreshold) {
                            stillHeld.delete(key)
                            continue
                        }
                        if (stillHeld.has(key)) continue

                        const direction = value > 0 ? "positive" : "negative"
                        finish({ ok: true, source: { type: "gamepad-axis", index, direction } })
                        return
                    }
                }

                rafId = requestAnimationFrame(pollGamepad)
            }

            rafId = requestAnimationFrame(pollGamepad)
        })
    }
}

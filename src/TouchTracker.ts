/**
 * touchTracker.ts
 * 指でHTML要素をなぞったとき、毎フレームの指の移動量(px)を計測する。
 *
 * - rAFループは呼び出し側が管理する
 * - getDelta() を毎フレーム呼ぶことで、前フレームからの変化量を取得する
 * - AbortController はクラス内部で保持し、remove() で一括解除する
 */

export namespace TouchTracker {
    export interface Delta {
        x: number // X軸方向の移動量 (px)
        y: number // Y軸方向の移動量 (px)
    }
}

export class TouchTracker {
    private readonly ac = new AbortController()

    // touchmove で随時上書きされる「最新」の座標
    private latestX: number | undefined = undefined
    private latestY: number | undefined = undefined

    // getDelta() 呼び出しごとに更新される「前フレーム時点」の座標
    private prevX: number | undefined = undefined
    private prevY: number | undefined = undefined

    private currentTouches: TouchList | undefined = undefined

    constructor(element: HTMLElement) {
        const { signal } = this.ac

        element.addEventListener(
            "touchstart",
            (e: TouchEvent) => {
                this.currentTouches = e.touches

                const t = e.touches[0]
                this.prevX = this.latestX = t.clientX
                this.prevY = this.latestY = t.clientY
            },
            { passive: true, signal },
        )

        element.addEventListener(
            "touchmove",
            (e: TouchEvent) => {
                this.currentTouches = e.touches

                const t = e.touches[0]
                this.latestX = t.clientX
                this.latestY = t.clientY
            },
            { passive: true, signal },
        )

        element.addEventListener("touchend", this.clearState, { signal })
        element.addEventListener("touchcancel", this.clearState, { signal })
    }

    touchesCount(): number {
        return this.currentTouches?.length ?? 0
    }

    getCurrentTouches(): TouchList | undefined {
        return this.currentTouches
    }

    /**
     * 前回 getDelta() を呼んだ時点からの移動量を返す。
     * タッチ中でなければ null。
     * 毎フレーム(rAFループ内)で呼ぶことを想定している。
     */
    getDelta(): TouchTracker.Delta | undefined {
        const { latestX, latestY, prevX, prevY } = this

        if (latestX === undefined || latestY === undefined || prevX === undefined || prevY === undefined) {
            return undefined
        }

        const dx = latestX - prevX
        const dy = latestY - prevY

        // 次フレームの基点を更新
        this.prevX = latestX
        this.prevY = latestY

        return { x: dx, y: dy }
    }

    /** イベントリスナーを一括解除してリソースを解放する */
    dispose(): void {
        this.ac.abort()
        this.clearState()
    }

    private readonly clearState = (): void => {
        this.currentTouches = undefined
        this.prevX = this.prevY = this.latestX = this.latestY = undefined
    }
}

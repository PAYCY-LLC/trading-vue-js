// Time-index mapping (for non-linear t-axis)

import Utils from '../../stuff/utils.js'

const MAX_ARR = Math.pow(2, 32)

export default class TI {

    constructor() {

        this.ib = false
    }

    init(params, res) {

        let {
            sub, onchart, interval, meta, $props:$p,
            interval_ms, sub_start, ib
        } = params

        this.ti_map = []
        this.it_map = []
        this.sub_i = []
        this.ib = ib
        this.sub = res
        this.ss = sub_start
        this.tf = interval_ms
        let start = meta.sub_start

        // Skip mapping for the regular mode
        if (this.ib) {
            this.map_sub(res)
        }

    }

    // Make maps for the main subset
    map_sub(res) {

        for (var i = 0; i < res.length; i++) {
            let t = res[i][0]
            let _i = (this.ss + i)
            this.ti_map[t] = _i
            this.it_map[_i] = t

            // Overwrite t with i
            let copy = [...res[i]]
            copy[0] = _i
            this.sub_i.push(copy)

        }

    }

    // Map overlay data
    // TODO: parse() called 3 times instead of 2 for 'spx_sample.json'
    // TODO: make possible to use indicies as timestamps
    parse(data) {

        if (!this.ib || !this.sub[0]) return data
        let res = []
        let k = 0 // Candlestick index

        // If indicator data starts after ohlcv, calc the first index
        if (data.length) {
            try {
                let k1 = Utils.fast_nearest(this.sub, data[0][0])[0]
                if (k1 !== null) k = k1
            } catch(e) { }
        }

        let t0 = this.sub[0][0]
        let tN = this.sub[this.sub.length - 1][0]

        for (var i = 0; i < data.length; i++) {
            let copy = [...data[i]]
            let _i = (this.ss + i)
            let tk = this.sub[k][0]
            let t = data[i][0]
            let index = this.ti_map[t]


            if (index === undefined) {

                // Linear extrapolation
                if (t < t0 || t > tN) {
                    index = this.ss + k - (tk - t) / this.tf
                }

                // Linear interpolation
                else {
                    let tk2 = this.sub[k + 1][0]
                    index = tk === tk2 ?  this.ss + k :
                        this.ss + k + (t - tk) / (tk2 - tk)
                    t = data[i+1] ? data[i+1][0] : undefined
                }

            }
            // Race of data points & sub points (ohlcv)
            // (like turn based increments)
            while (t > tk && k < this.sub.length - 2) {
                k++
                tk = this.sub[k][0]
            }
            copy[0] = index
            res.push(copy)
        }
        return res
    }

    // index => time
    i2t(i) {

        if (!this.ib || !this.sub.length) return i // Regular mode

        // Discrete mapping
        let res = this.it_map[i]
        if (res !== undefined) return res

        // Linear extrapolation
        else if (i >= this.ss + this.sub_i.length) {
            let di = i - (this.ss + this.sub_i.length) + 1
            let last = this.sub[this.sub.length - 1]
            return last[0] + di * this.tf
        }
        else if (i < this.ss) {
            let di = i - this.ss
            return this.sub[0][0] + di * this.tf
        }

        // Linear Interpolation
        let i1 = Math.floor(i) - this.ss
        let i2 = i1 + 1
        let len = this.sub.length

        if (i2 >= len) i2 = len - 1

        let sub1 = this.sub[i1]
        let sub2 = this.sub[i2]

        if (sub1 && sub2) {
            let t1 = sub1[0]
            let t2 = sub2[0]
            return t1 + (t2 - t1) * (i - i1 - this.ss)
        }
        return undefined

    }

    // time => index
    // TODO: when switch from IB mode to regular tools
    // disappear (bc there no more mapping)
    t2i(t) {
        if (!this.sub.length) return undefined

        // Discrete mapping
        let res = this.ti_map[t]
        if (res !== undefined) return res

        let t0 = this.sub[0][0]
        let tN = this.sub[this.sub.length - 1][0]

        // Linear extrapolation
        if (t < t0) {
            return this.ss - (t0 - t) / this.tf
        }

        else if (t > tN) {
            let k = this.sub.length - 1
            return this.ss + k - (tN - t) / this.tf
        }

        try {
            let i = Utils.fast_nearest(this.sub, t)
            let tk = this.sub[i[1]][0]
            return this.ss + i[1] - (tk - t) / this.tf
        } catch(e) { }

        return undefined
    }

    // Auto detect: is it time or index?
    // Assuming that index-based mode is ON
    smth2i(smth) {
        if (smth > MAX_ARR) {
            return this.t2i(smth) // it was time
        } else {
            return smth // it was an index
        }
    }

}
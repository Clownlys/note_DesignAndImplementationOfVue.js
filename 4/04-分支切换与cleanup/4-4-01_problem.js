// 依赖桶
const targetMap = new WeakMap()

// 原始数据
const data = { ok: true, a: 'hello world' }
let currentEffect
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        currentEffect = effectFn
        fn() // 执行副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
    }
    effectFn.deps = []
    effectFn()
}
function cleanup(effectFn) {
    effectFn.deps.forEach(dep => {
        dep.delete(effectFn)
    })
    effectFn.deps.length = 0
}
// 对原始数据的代理
const proxyData = new Proxy(data, {
    get(target, key) {
        // 依赖收集
        track(target, key)
        return target[key]
    },
    set(target, key, value) {
        target[key] = value
        trigger(target, key)
        return true
    }
})
function track(target, key) {
    if (!currentEffect) return
    let depsMap = targetMap.get(target)
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(currentEffect)
    currentEffect.deps.push(deps)
}
function trigger(target, key) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return
    const deps = depsMap.get(key)
    if (!deps) return
    deps.forEach(effectFn => {
        effectFn()
    })
}
// 副作用函数
function any() {
    console.log("effect run")  // 会死循环
    document.body.innerText = proxyData.ok ? proxyData.a : 'no data';
}

effect(any)
// 修改数据
setTimeout(() => {
    // 副作用函数中没有读取notExist属性, 所以不应该触发依赖
    proxyData.ok = false
}, 2000)


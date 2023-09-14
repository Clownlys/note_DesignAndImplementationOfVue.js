// 依赖桶
const targetMap = new WeakMap()


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
    const effectToRun = new Set(deps)
    effectToRun.forEach(effectFn => {
        effectFn()
    })
}


// 原始数据
const data = { foo: true, bar: true }
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

// 全局变量
let temp1, temp2

// effectFn1 嵌套了 effectFn2
effect(function effectFn1(){
    console.log("effectFn1 run")
    effect(function effectFn2(){
        console.log("effectFn2 run")
        // 在effectFn2中读取proxyData.bar属性
        temp2 = proxyData.bar
    })
    // 在effectFn1中读取proxyData.foo属性
    temp1 = proxyData.foo
})

setTimeout(() => {
    proxyData.foo = false  
}, 1000)

setTimeout(() => {
    proxyData.bar = false
}, 2000)

// 期望结果 1s后打印 effectFn1 run effectFn2 run, 2s后打印 effectFn2 run
// 实际结果 1s后打印 effectFn2 run, 2s后打印effectFn2 run

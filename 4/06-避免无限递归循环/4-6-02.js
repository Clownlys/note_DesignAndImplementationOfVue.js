// 依赖桶
const targetMap = new WeakMap()


let currentEffect = null; // 栈顶指针
const effectStack = []; // 栈
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn); // 清除依赖
        effectStack.push(effectFn); // 压入栈
        currentEffect = effectFn; // 栈顶指针指向当前执行的副作用函数
        fn();
        effectStack.pop(); // 弹出栈
        currentEffect = effectStack[effectStack.length - 1]; // 栈顶指针指向上一层副作用函数
    };
    effectFn.deps = [];
    effectFn();
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
    const effectToRun = new Set()
    deps.forEach(effectFn => {
        if (effectFn !== currentEffect) {
            effectToRun.add(effectFn)
        }
    })
    effectToRun.forEach(effectFn => {
        effectFn()
    })
}


// 原始数据
const data = { foo: 1 }
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

effect(function effectFn() {
    console.log("hello")
    proxyData.foo++ // proxyData.foo = proxyData.foo + 1
})


setTimeout(() => {
    console.log(proxyData.foo)
    proxyData.foo = 3
    console.log(proxyData.foo)
})
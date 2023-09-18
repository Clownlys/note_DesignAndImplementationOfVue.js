// 依赖桶
const targetMap = new WeakMap()


let currentEffect = null; // 栈顶指针
const effectStack = []; // 栈
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn); // 清除依赖
        effectStack.push(effectFn); // 压入栈
        currentEffect = effectFn; // 栈顶指针指向当前执行的副作用函数
        const res = fn();
        effectStack.pop(); // 弹出栈
        currentEffect = effectStack[effectStack.length - 1]; // 栈顶指针指向上一层副作用函数
        return res;
    };
    effectFn.deps = [];
    effectFn.options = options;
    if (!options.lazy) {
        effectFn();
    }
    return effectFn;
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
        if (effectFn.options && effectFn.options.scheduler) {
            effectFn.options.scheduler(effectFn)
        } else {
            effectFn()
        }
    })
}


// 原始数据
const data = { foo: 1, boo: 2 }
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

function computed(fn) {
    let value
    let lazy = true
    const getter = effect(fn, {
        lazy: true,
        scheduler: () => {
            lazy = true
        }
    })
    return {
        get value() {
            if (lazy) {
                value = getter()
                lazy = false
            }
            return value
        }
    }
}

const sum = computed(() => {
    console.log("执行了")  //仅打印一次
    return proxyData.foo + proxyData.boo
})
console.log(sum.value)
console.log(sum.value)
console.log(sum.value)




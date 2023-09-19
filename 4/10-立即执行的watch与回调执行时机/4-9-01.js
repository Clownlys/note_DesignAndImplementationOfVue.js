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
const data = { foo: 1, bar: 2 }
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
function watch(source, callback, options = {}) {
    let getter
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = traverse(source)
    }
    let newValue, oldValue
    const job = () => {
        newValue = effectFn();
        if (newValue !== oldValue) {
            callback(newValue, oldValue);
            oldValue = newValue;
        }
    };
    const effectFn = effect(() => getter(), {
        scheduler() {
            job()
        }
    })
    if (options && options.immidiate) {
        job()
    } else {
        oldValue = effectFn()
    }
}
// 递归读取响应式数据
function traverse(source, seen = new Set()) {
    // 如果source不是对象(primitive)或者为null, 或者已经被读取过, 则直接返回
    if (typeof source !== "object" || source === null || seen.has(source)) {
        return
    }
    // 将source添加到seen中, 避免重复
    seen.add(source)
    // 暂不考虑数组的情况
    console.log("source", source)
    // 如果source是对象, 则遍历对象的所有属性
    Object.keys(source).forEach(key => {
        traverse(source[key], seen)
    })
}
watch(
    () => proxyData.foo,
    (newValue, oldValue) => {
        console.log(`newValue: ${newValue}, oldValue: ${oldValue}`);
    },
    { immidiate: true }
);



// 因为proxy代理的层级低, 所以暂不考虑data中属性为对象和数组的情况
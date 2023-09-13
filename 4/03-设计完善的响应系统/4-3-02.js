// 依赖桶
const targetMap = new WeakMap()

// 原始数据
const data = {a:'hello world'}
let currentEffect
function effect(fn) {
    currentEffect = fn
    fn() // 执行副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
}
// 对原始数据的代理
function track(target, key){
    // 1. 先从桶中取出目标对象target对应的Map
    let depMap = targetMap.get(target)
    // 2. 如果没有, 就创建一个新的Map
    if(!depMap){
        depMap = new Map()
        targetMap.set(target, depMap)
    }
    // 3. 从Map中取出目标对象target的属性key对应的Set
    let deps = depMap.get(key)
    // 4. 如果没有, 就创建一个新的Set
    if(!deps){
        deps = new Set()
        depMap.set(key, deps)
    }
    // 5. 将副作用函数存入到Set中
    deps.add(currentEffect)
}
// 用于触发依赖
function trigger(target, key){
    // 1. 先从桶中取出目标对象target对应的Map
    let depMap = targetMap.get(target)
    // 2. 如果没有, 就直接返回
    if(!depMap) return
    // 3. 从Map中取出目标对象target的属性key对应的Set
    let deps = depMap.get(key)
    // 4. 如果没有, 就直接返回
    if(!deps) return
    // 5. 如果有, 就遍历Set, 执行里面的副作用函数
    deps.forEach(fn => fn())
}
const proxyData = new Proxy(data,{
    get(target, key){
        // 依赖收集
        track(target, key)
        return target[key]
    },
    set(target, key, value){
        target[key] = value
        // 依赖触发
        trigger(target, key)
        // 返回true代表设置成功
        return true
    }
})
// 副作用函数
function any(){
    console.log('effect run')  
    document.body.innerText = proxyData.a;
}

effect(any)
// 修改数据
setTimeout(() => {
    // 副作用函数中没有读取notExist属性, 所以不应该触发依赖
    proxyData.notExist = 'hello vue'
}, 1000)


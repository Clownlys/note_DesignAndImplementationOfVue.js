# 设计一个完善的响应系统
上一节, 我们硬编码副作用函数的名字(effect), 导致一旦副作用不叫effect, 就会出错, 所以我们需要设计一个完善的响应系统, 使得副作用函数的名字可以随意取, 都能被正确地收集到依赖中
```js
// 用一个全局变量来存储副作用函数
let currentEffect
// effect 函数用于注册副作用函数
function effect(fn) {
    currentEffect = fn
    fn() // 执行副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
}
```
上述代码中, 我们用一个全局变量currentEffect来存储副作用函数,他的作用是存储被注册的副作用函数. 接着重新定义了effect函数, 它变成了一个用来注册副作用函数的函数, 它接收的参数fn才是要注册的副作用函数.
```js
// 原effect作为副作用函数, 但是名字不叫effect
function fn(){
    document.body.innerText = obj.a
}
// 现在的effect函数用于注册副作用函数
function effect(fn) {
    currentEffect = fn
    fn() // 执行副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
}
effect(fn)
```
修改代理对象proxyData的get函数, 当触发obj.a的读取操作时, 就把副作用函数存入到obj.a的依赖中
```js
const obj = new Proxy(data, {
    get(target, key){
        // 依赖收集
        bucket.add(currentEffect)
        return target[key]
    },
    set(target, key, value){
        target[key] = value
        // 依赖触发
        bucket.forEach(fn => fn())
        // 返回true代表设置成功
        return true
    }
})
```
## 问题
在响应式数据obj上对不存在的属性进行set操作时,副作用函数理论上不应该触发, 但实际上却触发了, 为什么?
```js
// 副作用函数
function any(){
    console.log('effect run')  // 会打印2次
    document.body.innerText = proxyData.a;
}

effect(any)
// 修改数据
setTimeout(() => {
    // 副作用函数中没有读取notExist属性, 所以不应该触发依赖
    proxyData.notExist = 'hello vue'
}, 1000)
```
当我们对不存在的属性进行set操作时, 会触发代理对象proxyData的set函数, 从而触发依赖, 但是依赖中的副作用函数并没有读取notExist属性, 所以不应该触发依赖, 但是实际上却触发了, 这是因为我们在代理对象proxyData的set函数中, 用了forEach遍历依赖, 而forEach遍历依赖时, 会把依赖中的每一个副作用函数都执行一遍, 所以就会触发副作用函数, 从而导致副作用函数执行了两次.

原因: 使用Set数据结构作为存储副作用函数的"桶",并`没有在副作用函数与被操作的目标字段之间建立明确的联系`, 我们需要重新设计"桶"的数据结构.

首先要明确三级关系, 首先是目标对象target, 其次是目标对象的属性key, 最后是读取属性的副作用函数集合effectFnx
```
target
   └──key
       └──effectFn1
       └──effectFn2
```
选取WeakMap作为"桶"的数据结构, WeakMap的key是目标对象target, WeakMap的value是一个Map, Map的key是目标对象的属性key, Map的value是一个Set, Set中存储着读取属性的副作用函数集合
```js
// 存储副作用函数的"桶"
const targetMap = new WeakMap()
```
修改代理对象proxyData的get函数, 当触发obj.a的读取操作时, 就把副作用函数存入到obj.a的依赖中
```js
const proxyData = new Proxy(data,{
    get(target, key){
        // 依赖收集
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
        return target[key]
    },
    set(target, key, value){
        target[key] = value
        // 依赖触发
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
        // 返回true代表设置成功
        return true
    }
})
```
## 封装
将get拦截函数里收集依赖的逻辑封装成一个函数track, 将set拦截函数里触发依赖的逻辑封装成一个函数trigger
```js
// 用于收集依赖
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
```


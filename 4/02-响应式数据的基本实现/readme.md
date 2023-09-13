# 响应式数据的基本实现
思考: 如何让obj变成响应式数据?
- 当副作用函数effect执行时, obj.a的`读取操作(get函数)`会被执行, 从而将effect存入到obj.a的依赖中
- 当obj.a的`写入操作(set函数)`被执行时, 会通知obj.a的所有依赖(effect函数)重新执行

## 1. 拦截obj的读取操作(get函数)
```js
function effect(){
    document.body.innerText = obj.a
}
let obj = {a:1}
```
第一步, 执行effect函数, 触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
第二步, 设置obj.a时, 通知obj.a的所有依赖(effect函数)重新执行
```js
function effect(){
    document.body.innerText = obj.a
}
let obj = {a:1}
effect() // 触发obj.a的读取操作
obj.a = 2 // 通知obj.a的所有依赖(effect函数)重新执行
```
把依赖想象成一个桶bucket, 桶里装的就是一个个的effect函数, 当obj.a的读取操作触发时, 就把effect函数放入到obj.a的依赖中, 当obj.a的写入操作触发时, 就从obj.a的依赖中取出effect函数执行
```js
// 依赖桶
const bucket = new Set()

// 原始数据
const data = {a:1}
// 对原始数据的代理
const proxyData = new Proxy(data, {
    get(target, key){
        // 依赖收集
        bucket.add(effect)
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





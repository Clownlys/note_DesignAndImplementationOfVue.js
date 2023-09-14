# 避免无限递归循环
考虑一种情况, 在副作用函数中对响应式变量的属性做自增
```js
const data = { foo: 1 }
const proxyData = new Proxy(data /** */)
effect(() => {
    proxyData.foo++
})
```
在effect注册的副作用函数内有个自增操作, 该操作会引起栈溢出.

proxyData.foo++分解为proxyData.foo = proxyData.foo + 1, 来看一下执行流程
1. 首先读取proxyData.foo的值, 触发track收集依赖
2. 将proxyData.foo加1后的值再赋值给proxyData.foo, 触发trigger执行副作用函数
3. 步骤1和步骤2不停循环

## 解决思路
```
如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同, 则不触发执行
```
```js
function trigger(target, key) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return
    const deps = depsMap.get(key)
    if (!deps) return
    const effectToRun = new Set()
    deps.forEach(effectFn=>{
        if(effectFn !== currentEffect){
            effectToRun.add(effectFn)
        }
    })
    effectToRun.forEach(effectFn => {
        effectFn()
    })
}
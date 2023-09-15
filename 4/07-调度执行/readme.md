# 调度执行
## 定义
`可调度性`指trigger动作触发副作用函数重新执行时, 有能力决定副作用函数`执行的时机`、`次数`以及`方式`的能力。

来看一个例子
```js
const data = { foo: 1 }
const proxyData = new Proxy(data, {/** */})
effect(()=>{
    console.log(proxyData.foo)
})
proxyData.foo++
console.log("结束了")
```
这段代码输出结果如下
```
1
2
结束了
```
现在需求有变, 输出顺序调整为
```
1
结束了
2
```
这个需求可以通过`调度执行`来实现, 我们为effect设计一个选项参数options, 它是一个对象, 有一个名为`scheduler`的属性用于指定调度函数, 伪代码如下
```js
effect(()=>{
    console.log(proxyData.foo)
}, {
    scheduler: (effect)=>{
        // effect是一个函数, 用于执行副作用函数
        // 通过调用effect函数来执行副作用函数
        effect()
    }
})
``` 
## 实现
在effect函数内部把options挂载到对应的副作用函数上
```js
function effect(fn, options = {}){
    const effectFn = ()=>{
        cleanup(effectFn)
        currentEffect = effectFn
        effectStack.push(effectFn)
        fn()
        effectStack.pop()
        currentEffect = effectStack[effectStack.length - 1]
    }
    // 将options挂载到effectFn上
    effectFn.options = options
    effectFn.deps = []
    effectFn()
}
```
在trigger函数内部, 通过判断副作用函数是否有options属性来决定是否调用scheduler函数
```js
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
```
如上述代码所示, 在trigger动作触发副作用函数执行时, 会先判断副作用函数是否有options属性, 如果有, 则调用scheduler函数, 否则直接执行副作用函数。

## 使用
有了调度执行, 我们可以实现之前的需求了
```js
const data = { foo: 1 }
const proxyData = new Proxy(data, {/** */})
effect(()=>{
    console.log(proxyData.foo)
}, {
    scheduler: (effect)=>{
        // 将副作用函数放到宏任务队列中执行
        setTimeout(effect, 0)
    }
})
proxyData.foo++
console.log("结束了")
```
输出结果和我们想要的一样
```
1
结束了
2
```

### 控制执行次数
我们可以通过调度执行来控制副作用函数的执行次数, 我们思考一个新需求
```js
const data = { foo: 1 }
const proxyData = new Proxy(data, {/** */})
effect(()=>{
    console.log(proxyData.foo)
})
proxyData.foo++
proxyData.foo++
```
这段代码输出结果如下
```
1
2
3
```
由输出可知, 字段proxyData.foo的值一定会从1自增到3, 2只是过渡状态. 如果我们仅关注最终结果而不关注过程, 那输出2是多余的, 我们期望的打印结果是:
```
1
3
```
基于调度器实现这个需求
```js
// 定义一个任务队列
const jobQueue = new Set()
// 使用Promise.resolve()创建一个promise实例
const p = Promise.resolve()

// 一个标志位, 用于标识是否有任务正在执行
let isPending = false
function flushJob() {
    // 如果有任务正在执行, 则直接返回
    if (isPending) return
    // 将标志位置为true
    isPending = true
    // 执行任务队列中的任务
    p.then(()=>{
        jobQueue.forEach(job=>{
            job()
        })
    }).finally(()=>{
        // 将标志位置为false
        isPending = false
        // 清空任务队列
        jobQueue.clear()
    })
}

effect(()=>{
    console.log(proxyData.foo)
}, {
    scheduler: (effect)=>{
        // 将effect函数放到任务队列中
        jobQueue.add(effect)
        // 执行任务队列中的任务
        flushJob()
    }
})
```
<!-- @format -->

# 计算属性 computed 与 lazy

## 懒加载

目前我们实现的 effect 函数会立即执行传递给它的副作用函数, 但是有些场景下我们不希望 effect 在注册副作用函数时立马执行一次, 而是期望在第一次触发时执行, 这种需求在 vue 中是很常见的, 我们称之为懒加载, 例如计算属性

我们可以通过在 options 中添加一个 lazy 属性

```js
effect(
  () => {
    console.log(proxyData.foo);
  },
  {
    lazy: true,
  },
);
```

lazy 属性和之前的 scheduler 一样, 通过 options 传递给 effect 函数, 但是 lazy 属性的值是一个布尔值, 用来标识是否是懒加载, 我们在 effect 函数中做如下处理

```js
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup();
    effectStack.push(effectFn);
    currentEffect = effectFn;
    fn();
    effectStack.pop();
    currentEffect = effectStack[effectStack.length - 1];
  };
  effectFn.options = options;
  effectFn.deps = [];
  // 只有在lazy值为false时才执行effectFn
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}
```

通过上述代码, 我们就实现了让副作用函数不立即执行的功能. 由此引申出一个问题, 我们如何在第一次触发时执行副作用函数呢? 因为没有在注册的时候执行副作用函数, 所有我们需要手动执行副作用函数来完成依赖第一次的依赖收集

```js
const effectFn = effect(
  () => {
    console.log(proxyData.foo);
  },
  {
    lazy: true,
  },
)();
// 手动执行副作用函数
effectFn();
```

考虑一个新的需求, 传递给 effect 注册的副作用函数是一个 getter, 会有一个返回值

```js
effect(() => proxyData.foo + proxyData.obj, {
  lazy: true,
});
```

为了接收到这个返回值, 我们需要修改部分代码

```js
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup();
    effectStack.push(effectFn);
    currentEffect = effectFn;
    // 执行副作用函数, 并返回结果
    const result = fn();
    effectStack.pop();
    currentEffect = effectStack[effectStack.length - 1];
    return result;
  };
  effectFn.options = options;
  effectFn.deps = [];
  // 只有在lazy值为false时才执行effectFn
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}
```

到目前为止, 我们已经能够实现懒加载的副作用函数了, 并且也能够拿到副作用函数的返回值, 接下来我们去实现计算属性, 我们暂时只考虑 getter 操作

```js
function computed(getter) {
  // 把getter作为副作用函数, 创建一个懒加载的副作用函数
  const effectFn = effect(getter, { lazy: true });
  return {
    get value() {
      // 手动执行副作用函数, 并返回结果
      return effectFn();
    },
  };
}
```
至此, 我们已经实现了一个简单的计算属性, 让我们来看看它的使用方式
```js
const data = { foo: 1, bar: 2}
const proxyData = new Proxy(data, /**   */) 
const sumRes = computed(() => proxyData.foo + proxyData.bar)
console.log(sumRes.value) // 3
proxyData.foo = 2
console.log(sumRes.value) // 4
```
上述代码中, 我们每次访问 sumRes.value 时, 都会执行一次副作用函数, 但是我们希望只有当 foo 或者 bar 发生变化时才执行副作用函数, 也就是对结果进行缓存, 我们修改computed函数的实现
```js
function computed(getter){
    // value用来缓存上一次的计算值
    let value
    // dirty用来标识是否需要重新计算
    let dirty = true
    // 把getter作为副作用函数, 创建一个懒加载的副作用函数
    const effectFn = effect(getter, {
        lazy: true,
        // 重新计算时, 把dirty设置为true
        scheduler: ()=>{
            // 重新计算时, 把dirty设置为true
            dirty = true
        }
    })
    return {
        get value(){
            // 如果dirty为true, 重新计算
            if(dirty){
                value = effectFn()
                dirty = false
            }
            return value
        }
    }
}
```
### computed嵌套
我们再考虑一个新的需求, 计算属性可以嵌套, 例如
```js
const data = { foo: 1, bar: 2}
const proxyData = new Proxy(data, /**   */)
const sumRes = computed(() => proxyData.foo + proxyData.bar)
effect(()=>{
    console.log(sumRes.value)
})
```
这个需求简单说就是让sumRes也拥有响应式, 当foo或者bar发生变化时, sumRes也会重新计算, 我们修改computed函数的实现
```js
function computed(getter){
    // value用来缓存上一次的计算值
    let value
    // dirty用来标识是否需要重新计算
    let dirty = true
    // 把getter作为副作用函数, 创建一个懒加载的副作用函数
    const effectFn = effect(getter, {
        lazy: true,
        // 重新计算时, 把dirty设置为true
        scheduler: ()=>{
            // 重新计算时, 把dirty设置为true
            dirty = true
            trigger(obj, 'value')
        }
    })
    let obj = {
        get value(){
            // 如果dirty为true, 重新计算
            if(dirty){
                value = effectFn()
                dirty = false
            }
            track(obj, 'value')
            return value
        }
    }
    return obj
}
```
现在, 建立起的联系如下所示
```
computed(obj)
        └──value
            └──effectFn
```

<!-- @format -->

# watch 的实现原理

watch 的本质就是观测响应式数据, 当数据发生变化时执行传入 watch 函数的回调函数

```js
watch(proxyData, () => {
  console.log("obj的值发生了变化");
});
proxyData.foo++;
```

watch 函数的实现本质上是利用了 effect 函数以及 options.scheduler 选项, 我们先来实现一个简单的 watch 函数

```js
function watch(callback) {
  effect(
    () => {
      console.log(proxyData.foo);
    },
    {
      scheduler: callback,
    },
  );
}
watch(() => {
  console.log("obj的值发生了变化");
});
proxyData.foo++;
```

上述代码能正常工作, 但是我们硬编码了对 proxyData.foo 的读取, 我们需要将其改为动态的具有通用性的

```js
function watch(source, callback) {
  effect(
    () => {
      traverse(source);
    },
    {
      scheduler: callback,
    },
  );
}
// 递归读取响应式数据
function traverse(source, seen = new Set()) {
  // 如果source不是对象(primitive)或者为null, 或者已经被读取过, 则直接返回
  if (typeof source !== "object" || source === null || seen.has(value)) {
    return;
  }
  // 将source添加到seen中, 避免重复
  seen.add(source);
  // 如果source是数组, 则遍历数组
  if (Array.isArray(source)) {
    source.forEach((item) => {
      traverse(item, seen);
    });
  } else {
    // 如果source是对象, 则遍历对象的所有属性
    Object.keys(source).forEach((key) => {
      traverse(source[key], seen);
    });
  }
}
```

### watch 接收 getter 函数作为 source

watch 函数除了观测响应式数据, 还可以接收一个 getter 函数

```js
watch(
  () => proxyData.foo,
  () => {
    console.log("proxyData.foo的值变化了");
  },
);
```

修改 watch 函数

```js
function watch(source, callback) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  effect(() => getter(), {
    scheduler() {
      callback();
    },
  });
}
```

目前, 接收 getter 的功能已经实现了, 现在面临一个新的问题, 如何获取到监听前后的 value 值变化

```js
watch(
  () => proxyData.foo,
  (newValue, oldValue) => {
    console.log(`newValue: ${newValue}, oldValue: ${oldValue}`);
  },
);
```
让我们想想, getter是有返回值的, 我们可以使用lazy选项, 把返回值存储到effectFn中
```js
function watch(source, callback){
    let getter
    if(typeof source ==='function'){
        getter = source
    } else {
       getter = traverse(source)
    }
    let newValue, oldValue
    const effectFn = effect(()=>getter(),{
        lazy: true,
        scheduler(effectFn){
            newValue = effectFn()
            callback(newValue, oldValue)
            oldValue = newValue
        }
    })
    // 初始化时, 执行一次effectFn, 保存旧值
    oldValue = effectFn()
}
```

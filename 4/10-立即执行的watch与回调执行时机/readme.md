<!-- @format -->

# 立即执行的 watch 与回调执行时机

## 立即执行的回调函数

默认情况下, 一个 watch 的回调函数是在响应式数据发生变化之后才会执行, 但是有时候我们需要在 watch 函数执行的时候立即执行回调函数, 例如我们需要在页面加载的时候立即执行一次回调函数, 这个时候我们可以使用 immediate 选项

```js
watch(
  proxyData,
  () => {
    console.log("proxyData的值变化了");
  },
  {
    immediate: true,
  },
);
```

当 immediate 的值为 true 时, 回调函数会在创建时立即执行一次. 回调函数的立即执行与后续执行本质上没有区别, 都是在 scheduler 函数中执行的, 所以我们把 scheduler 函数封装为一个通用函数

```js
function watch(source, callback, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  let newValue, oldValue;
  const job = () => {
    newValue = effectFn();
    if (newValue !== oldValue) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  };
  const effectFn = effect(() => getter(), {
    lazy: true, // 这个lazy时为了手动获取到第一次调用getter的返回值
    scheduler: () => {
      job();
    },
  });

  if (options && options.immediate) {
    job();
  } else {
    // 由于立即执行, 所以没有所谓的旧值, 所以直接传递undefined
    oldValue = effectFn(); 
  }
}
```

## 执行时机
再Vue.js3中可以使用flush选项来指定回调函数的执行时机, flush选项有三个值: pre, post, sync, 默认值是post, 也就是在响应式数据发生变化之后执行回调函数, pre表示在响应式数据发生变化之前执行回调函数, sync表示在响应式数据发生变化之后立即执行回调函数, 无论是哪种执行时机, 都是在scheduler函数中执行的, 所以我们可以把scheduler函数封装为一个通用函数

```js
function watch(source, callback, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  let newValue, oldValue;
  const job = () => {
    newValue = effectFn();
    if (newValue !== oldValue) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  };
  const effectFn = effect(() => getter(), {
    lazy: true, // 这个lazy时为了手动获取到第一次调用getter的返回值
    scheduler: () => {
      if (options && options.flush === "sync") {
        job();
      } else {
        const p = Promise.resolve();
        p.then(job)
      }
    },
  });

  if (options && options.immediate) {
    job();
  } else {
    // 由于立即执行, 所以没有所谓的旧值, 所以直接传递undefined
    oldValue = effectFn();
  }
}
```
在调度器函数内部检测options.flush的值, 如果是sync, 则立即执行回调函数, 如果为post,否则使用Promise.resolve().then()的方式延迟执行回调函数, 这样就可以实现在响应式数据发生变化之后立即执行回调函数的功能了, 至于pre选项, 我们暂时没有办法模拟

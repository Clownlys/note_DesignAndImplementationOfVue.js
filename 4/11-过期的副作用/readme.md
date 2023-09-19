<!-- @format -->

# 过期的副作用

## 竟态问题

竟态问题是指多个线程对同一数据进行操作时，最终的结果与执行顺序有关。在前端中相似的场景有：

多个请求同时修改同一条数据，最终的结果与请求的执行顺序有关

```js
let finalData;
watch(proxyData, async () => {
  // 发送网络请求
  const res = await fetch("path/to/request");
  finalData = res;
});
```

在这段代码中，我们使用 watch 函数监听 proxyData 的变化，当 proxyData 发生变化时，我们会发送一个网络请求，然后把请求的结果赋值给 finalData。但是由于网络请求是异步的，所以当多个请求同时修改 proxyData 时，最终的结果与请求的响应顺序有关。

在 Vue.js 中, watch 函数的回调函数接收第三个参数 onInvalidate, 这个函数用来注册一个在副作用函数过期时执行的回调函数

```js
let count = 0
let finalData;
watch(() => proxyData.foo, async (newValue, oldValue, onInvalidate) => {
    // 定义一个标志, 代表当前副作用是否过期
    let expired = false;
    // 调用onInvalidate注册一个过期时执行的回调函数
    onInvalidate(() => {
        expired = true;
    });
    const res = await new Promise((resolve) => {
        setTimeout(() => {
            resolve("请求结果"+ (++count));
        }, count === 0 ? 5000 : 1000);
    });
    if (!expired) {
        finalData = res
    }
}, {
    flush: 'sync'
});

proxyData.foo++

setTimeout(() => {
    proxyData.foo++
}, 500)
```
onInvalidate原理其实很简单, 在调度函数scheduler中执行回调函数callback前先调用onInvalidate注册的过期回调
```js
function watch(source, callback, options){
    // ...
    let cleanup
    const onInvalidate = (fn)=>{
        cleanup = fn
    }
    // ...
    const job = ()=>{
        if(cleanup){
            cleanup()
        }
        newValue = effectFn()
        if(newValue !== oldValue){
            callback(newValue, oldValue, onInvalidate)
            oldValue = newValue
        }
    }
}
```
最后查看finalData中存放的结果 - "请求结果2", 表明第一个请求的结果被最后一个请求覆盖了, 这就是竟态问题以及解决方式


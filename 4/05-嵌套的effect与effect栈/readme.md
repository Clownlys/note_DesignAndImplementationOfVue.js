<!-- @format -->

# effect 嵌套

考虑一种情况, 副作用函数中又包含了副作用函数, 也就是说, 副作用函数中又注册了副作用函数

```js
effect(function effectFn1() {
  effect(function effectFn2() {
    /** */
  });
  /** */
});
```

测试一下在上一章实现的代码

```js
// 原始数据
const data = { foo: true, bar: true };
// 代理对象
const proxyData = new Proxy(data /** */);

// 全局变量
let temp1, temp2;

// effectFn1 嵌套了 effectFn2
effect(function effectFn1() {
  console.log("effectFn1 run");
  effect(function effectFn2() {
    console.log("effectFn2 run");
    // 在effectFn2中读取proxyData.bar属性
    temp2 = proxyData.bar;
  });
  // 在effectFn1中读取proxyData.foo属性
  temp1 = proxyData.foo;
});
```

`理想情况`下他们的依赖如图所示:

```
proxyData
    └── foo
        └── effectFn1
    └── bar
        └── effectFn2
```

此时我们尝试修改 obj.foo 的值

```js
setTimeout(() => {
  proxyData.foo = false;
}, 1000);
```

理想状况, 控制台将在 1s 后输出 effectFn1 run, effectFn2 run, 因为修改 proxy.foo 时出发了 effectFn1 执行, 并且由于 effectFn2 嵌套在 effectFn1 里, 所以也会嵌套触发 effectFn2 执行.

实际结果, 控制台在 1s 后打印了 effectFn2 run, 从结论推断, proxyData.foo 的修改触发的是 effectFn2 的执行, 而非所期望的 effectFn1 的执行.

## 问题

为什么修改 proxyData.foo 的值会触发 effectFn2 的执行, 而非所期望的 effectFn1 的执行? 来看一下 effect 的执行过程

1. 在 effectFn1 执行时, 将 effectFn1 存入到全局变量 currentEffect 中
2. 在 effectFn2 执行时, 将 effectFn2 存入到全局变量 currentEffect 中
3. 在 effectFn1 函数执行到 temp1 = proxyData.foo 时, 会触发 proxyData.foo 的读取操作, 从而触发代理对象 proxyData 的 get 函数, 从而触发依赖收集, 此时会把 currentEffect 指向的副作用函数 effectFn2 存入到 proxyData.foo 的依赖中

同一时刻 currentEffect 所存储的副作用函数只能有一个, 当副作用函数发生嵌套时, 内层副作用函数的执行会覆盖 currentEffect 的值, 且永远不会恢复到外层副作用函数的值, 所以在 effectFn1 执行到 temp1 = proxyData.foo 时, currentEffect 的值已经是 effectFn2 了, 所以会把 effectFn2 存入到 proxyData.foo 的依赖中.

## 解决思路

使用栈结构, 将当前执行副作用函数压入栈中, 当副作用函数执行完毕时, 再从栈中弹出当前执行副作用函数, 从而恢复到上一层副作用函数的值.

```js
let currentEffect = null; // 栈顶指针
const effectStack = []; // 栈
function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn); // 清除依赖
    effectStack.push(effectFn); // 压入栈
    currentEffect = effectFn; // 栈顶指针指向当前执行的副作用函数
    fn();
    effectStack.pop(); // 弹出栈
    currentEffect = effectStack[effectStack.length - 1]; // 栈顶指针指向上一层副作用函数
  };
  effectFn.deps = [];
  effectFn();
}
```

<!-- @format -->

# 分支切换

## 定义
```js
const data = { ok: true, text: "hello world" };
const obj = new Proxy(data, {
  /** */
});
effect(() => {
  document.body.innerText = obj.ok ? obj.text : "not";
});
```
上面的代码中，字段obj.ok的初始值为true，此时副作用函数effectFn的执行会触发字段obj.ok与字段obj.text这两个属性的get操作，此时的依赖关系用图表示如下：


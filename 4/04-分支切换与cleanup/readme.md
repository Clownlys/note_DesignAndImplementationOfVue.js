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

上面的代码中，字段 obj.ok 的初始值为 true，此时副作用函数 effectFn 的执行会触发字段 obj.ok 与字段 obj.text 这两个属性的 get 操作，此时的依赖关系用图表示如下：

```
obj
   └──ok
       └──effectFn
   └──text
       └──effectFn
```

可以看出来，副作用函数 effectFn 分别被字段 data.ok 和字段 data.text 的依赖集合所收集，此时我们把字段 data.ok 的值改为 false，此时副作用函数 effectFn 的执行会触发字段 data.ok 的读取，`理想情况`下，副作用函数 effectFn 应该不再被 data.text 字段对应的依赖集合收集, 如下图所示：

```
obj
   └──ok
       └──effectFn
   └──text
```

但是实际上，副作用函数 effectFn 仍然被字段 data.text 对应的依赖集合收集，如下图所示：

```
obj
   └──ok
       └──effectFn
   └──text
       └──effectFn
```

副作用函数 effectFn 仍然被字段 data.text 对应的依赖集合收集，但是字段 data.text 对应的依赖集合中的副作用函数 effectFn 并不应该再被字段 data.text 的读取操作触发(`因为obj.ok已经是false了`)，无论 obj.text 的值怎么变化, document.body.innerText 都应该是'not'了, 所以不需要重新执行副作用函数 effectFn.

解决思路:

1. 每次执行副作用函数时, 先清空副作用函数 effectFn 的依赖集合 Set
2. 副作用函数执行完毕时, 会重新建立联系(收集依赖)

第一次执行副作用函数, 收集依赖

```
obj
   └──ok
       └──effectFn
   └──text
        └──effectFn
```

设置 obj.ok 为 false, 执行副作用函数

```
// 先清除所有的依赖
obj
   └──ok
   └──text
//  重新建立联系
obj
   └──ok
       └──effectFn
   └──text
```

## cleanup

思考一下如何清除依赖, 实际上我们要做的就是`断开副作用函数与响应式数据之间的联系`, 现在的数据结构是这样的:

```
obj
   └──ok(Set)
       └──effectFn
   └──text(Set)
       └──effectFn
```

我们要做的是就在执行副作用函数 effectFn 时把 Set 依赖集合中的副作用函数 effectFn 给清除(remove), 我们先要找到哪些 Set 包含了它

但是现在的数据结构中, 依赖集合中可以找到副作用函数, 但是副作用函数却找不到依赖集合, 所以我们需要在副作用函数中存储依赖集合, 使得副作用函数能够找到依赖集合, 从而在执行副作用函数的时候可以断开副作用函数与响应式数据之间的联系.

```js
// 用一个全局变量来存储副作用函数
let currentEffect
function effect(fn){
  const effectFn = (){
    // 依赖收集
    currentEffect = effectFn
    fn() // 执行真正的副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
  }
  // 用一个数组来存储依赖集合
  effectFn.deps = []
  // 执行包装后的副作用函数
  effectFn()
}
function track(target, key){
  if(!currentEffect) return
  // 依赖收集
  let depsMap = targetMap.get(target)
  if(!depsMap){
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let deps = depsMap.get(key)
  if(!deps){
    deps = new Set()
    depsMap.set(key, deps)
  }
  // 将副作用函数存入到Set中
  deps.add(currentEffect)
  // 将依赖集合存入到副作用函数中
  currentEffect.deps.push(deps)
}
```

如上述代码, 在 tracker 函数中, 我们将依赖集合 deps 存入到副作用函数 effectFn 中, 这样在执行副作用函数 effectFn 时, 我们就可以通过 effectFn.deps 找到依赖集合, 从而在执行副作用函数 effectFn 时, 将副作用函数 effectFn 从依赖集合 deps 中清除(remove), 从而实现清除依赖的目的.

```js
// 用一个全局变量来存储副作用函数
let currentEffect
function effect(fn){
  const effectFn = (){
    cleanup(effectFn)
    // 依赖收集
    currentEffect = effectFn
    fn() // 执行真正的副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
  }
  // 用一个数组来存储依赖集合
  effectFn.deps = []
  // 执行包装后的副作用函数
  effectFn()
}
```

cleanup 函数的实现

```js
function cleanup(effectFn) {
  // 从副作用函数中取出依赖集合
  // 遍历依赖集合, 将副作用函数从依赖集合中清除
  for (let deps of effectFn.deps) {
    depSet.delete(effectFn);
  }
  // 重置effectFn.deps数组
  deps.length = 0;
}
```

### 问题

尝试运行代码, 发现目前的实现会导致无限循环执行副作用函数, 为什么会出现这种情况呢?

```js
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const deps = depsMap.get(key);
  if (!deps) return;
  deps.forEach((effectFn) => {
    // 问题出在这句代码
    effectFn();
  });
}
```

在执行 trigger 函数时, 会遍历依赖集合 deps, 从而执行副作用函数 effectFn, 但是执行副作用函数 effectFn 时, 会执行 cleanup 函数, 从而清除依赖集合 deps 中的 effectFn, 之后读取 obj.a 的值时, 会触发 get 拦截函数, 从而执行 track 函数, 从而将副作用函数 effectFn 重新存入到依赖集合 deps 中, 从而导致无限循环执行副作用函数 effectFn.

```js
const set = new Set([1]);
set.forEach((item) => {
  item.delete(1);
  item.add(1);
  console.log("遍历中");
});
```

在调用 forEach 遍历 Set 集合时, 将已经遍历过的值删除再添加, 会使得遍历永远无法结束.

改进: 使用当前 Set 构建另一个 Set, 遍历复制出来的 Set, 原 Set 集合的改动不会影响到复制出来的 Set

```js
const set = new Set([1]);
const newSet = new Set(set);
newSet.forEach((item) => {
  set.delete(1);
  set.add(1);
  console.log("遍历中");
});
```

修改后的 trigger 函数

```js
function trigger(target, key) {
  let depsMap = targetMap.get(target);
  if (!depsMap) return;
  let deps = depsMap.get(key);
  if (!deps) return;
  const effectsToRun = new Set(deps);
  effectsToRun.forEach((effectFn) => effectFn());
}
```

